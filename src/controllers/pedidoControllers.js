import Pedido from "../models/pedido.model.js";
import Equipo from "../models/equipo.model.js";
import Item from "../models/item.model.js";
import { verificarConflictos } from "../services/pedidoConflictos.js";
import Reserva from "../models/reserva.model.js";
import { calcularVentana } from "../services/fechasReserva.js";
import {
  aprobarConReserva,
  asignarLotesFIFO,
  ConflictoStockError,
} from "../services/aprobacionReserva.js";
import { validarAnticipacionPedido } from "../services/pedidoValidaciones.js";
import { registrarHistorial } from "../services/pedidoHistorial.js";
import isEqual from "lodash.isequal";

const getPedidos = async (req, res) => {
  try {
    const { id, rol } = req.usuario;

    let filtro = { activo: { $ne: false } };

    if (rol === "DOCENTE") {
      filtro.docente = id;
    }

    const pedidos = await Pedido.find(filtro)
      .populate("docente", "nombre apellido email")
      .populate("laboratorio", "nombre tipo")
      .populate({
        path: "recursos.recursoId",
        select: "nombre tipo codigo esFijo estado",
      })
      .populate({
        path: "comentarios.usuario",
        select: "nombre apellido rol",
      })
      .sort({ fechaHora: -1 });

    const pedidosConNotificacion = pedidos.map((p) => {
      const ultimoComentario = p.comentarios?.[p.comentarios.length - 1];

      const visto = p.vistoPor?.find(
        (v) => v.usuario?.toString() === id
      );

      const ultimoVisto = visto?.ultimoComentarioVisto;

      const hayNoVistos =
        ultimoComentario &&
        (!ultimoVisto ||
          new Date(ultimoComentario.createdAt) > new Date(ultimoVisto));

      return {
        ...p.toObject(),
        tieneComentariosNuevos: hayNoVistos,
      };
    });

    res.json(pedidosConNotificacion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPedidoById = async (req, res) => {
  try {
    const { id: userId, rol } = req.usuario;
    const { id } = req.params;

    const pedido = await Pedido.findById(id)
      .populate("docente", "nombre apellido email")
      .populate("laboratorio", "nombre tipo")
      .populate({
        path: "recursos.recursoId",
        select: "nombre tipo codigo esFijo estado",
      })
      .populate({
        path: "comentarios.usuario",
        select: "nombre apellido rol"
      })
      .populate({
        path: "historial.usuario",
        select: "nombre apellido rol"
      });    

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (
      rol === "DOCENTE" &&
      pedido.docente._id.toString() !== userId
    ) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const conflictos = await verificarConflictos(pedido);

    res.json({
      ...pedido.toObject(),
      conflictos,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const aprobarPedido = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pedido = await Pedido.findById(id);
    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (pedido.estado !== "Pendiente") {
      return res.status(400).json({ error: "El pedido ya fue aceptado previamente y sus recursos ya fueron descontados." });
    }

    // Auto-sanación: si un intento previo creó la reserva pero no llegó a persistir
    // el pedido (quedó Pendiente), esa reserva es huérfana y bloquearía el reintento
    // por el índice único de pedidoId. La eliminamos antes de recrear.
    await Reserva.deleteOne({ pedidoId: pedido._id });

    // 1. Doble verificación de disponibilidad antes de mutar (para evitar descuentos parciales)
    const conflictos = await verificarConflictos(pedido);

    const conflictosGraves = conflictos.filter(
      c => c.severidad === "alta"
    );

    if (conflictosGraves.length > 0) {
      return res.status(400).json({
        error: "El pedido tiene conflictos",
        conflictos,
      });
    }

    // 2. Armar checklist y los materiales/equipos de la reserva.
    //    NUEVO MODELO (docs/stock-disponibilidad-temporal.md §3): la aprobación
    //    NO decrementa cantidadDisponible. Para materiales solo se asignan
    //    punteros FIFO de lotes (trazabilidad para descartes) sin tocar stock.
    //    El decremento físico de consumibles ocurre al pasar a "En Curso" (§7).
    const checklist = [];
    let requiereCarrito = false;
    const equiposReservados = [];
    const materialesReservados = [];

    for (const r of pedido.recursos) {
      const ref = r.modeloRef || r.tipoRecurso;

      if (ref === "Equipo") {
        requiereCarrito = true;
        checklist.push({
          descripcion: "Acondicionar equipo reservado y verificar su funcionamiento.",
          tipo: "Logistica"
        });
        equiposReservados.push({ equipoId: r.recursoId });
      } else if (ref === "Item") {
        const item = await Item.findById(r.recursoId);

        if (item) {
          requiereCarrito = true;
          if (item.tipo === "reactivo") {
            if (item.requiereReceta) {
              checklist.push({
                descripcion: `Preparar reactivo a partir de sustancias base: ${item.nombre}.`,
                tipo: "Preparacion"
              });
            } else {
              checklist.push({
                descripcion: `Asegurar disponibilidad del reactivo: ${item.nombre}. Gestionar compra si el stock base es bajo.`,
                tipo: "Compra"
              });
            }
          } else if (item.tipo === "material") {
            checklist.push({
              descripcion: `Acondicionar material: ${item.nombre}.`,
              tipo: "Logistica"
            });
          }
        }

        // Punteros FIFO sin decrementar stock (invariante §3.1).
        const lotesUsados = await asignarLotesFIFO(r.recursoId, r.cantidad);
        materialesReservados.push({
          itemId: r.recursoId,
          cantidadTotal: r.cantidad,
          lotesUsados,
        });
      }
    }

    if (requiereCarrito) {
      checklist.push({
        descripcion: "Colocar todos los materiales, equipos y reactivos en los carritos destinados al aula.",
        tipo: "General"
      });
    }

    // 3. Crear la Reserva con gate de disponibilidad anti-write-skew (§5).
    //    Se hace ANTES de mutar el pedido: si no alcanza el stock, el pedido
    //    queda intacto en "Pendiente".
    const { inicio, fin } = calcularVentana(pedido.fechaHora, pedido.duracionClase);
    let nuevaReserva;
    try {
      nuevaReserva = await aprobarConReserva({
        datosReserva: {
          pedidoId: pedido._id,
          laboratorioId: pedido.laboratorio,
          docenteId: pedido.docente,
          fechaHora: pedido.fechaHora,
          duracionClase: pedido.duracionClase,
          equiposReservados,
          materialesReservados,
        },
        materiales: materialesReservados,
        inicio,
        fin,
      });
    } catch (error) {
      if (error instanceof ConflictoStockError) {
        return res.status(400).json({
          error: "El pedido tiene conflictos",
          conflictos: [
            {
              tipo: "stock_insuficiente",
              severidad: "alta",
              mensaje: error.message,
            },
          ],
        });
      }
      throw error;
    }

    // 4. Actualizar estado del pedido (reserva ya creada con éxito).
    pedido.estado = "Aceptado";

    registrarHistorial(
      pedido,
      req.usuario.id,
      "APROBACION",
      "Pedido aprobado",
      {
        estado: {
          antes: "Pendiente",
          despues: "Aceptado"
        }
      }
    );

    pedido.checklist = checklist;
    let pedidoAprobado;
    try {
      pedidoAprobado = await pedido.save();
    } catch (saveErr) {
      // Compensación: la reserva ya se creó; si el pedido no pudo persistirse,
      // eliminamos la reserva para no dejar un huérfano que trabe reintentos.
      await Reserva.deleteOne({ _id: nuevaReserva._id });
      throw saveErr;
    }

    // Poblamos para devolver el objeto completo al frontend
    await pedidoAprobado.populate([
      { path: "docente", select: "nombre apellido email" },
      { path: "laboratorio", select: "nombre tipo" },
      { path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado" }
    ]);

    res.json({ message: "Pedido aprobado. Reserva creada y disponibilidad confirmada.", pedido: pedidoAprobado, reservaId: nuevaReserva._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const finalizarPedido = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pedido = await Pedido.findById(id);
    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (pedido.estado !== "Aceptado") {
      return res.status(400).json({ error: "El pedido debe estar en estado 'Aceptado' para poder finalizarse." });
    }

    // NUEVO MODELO (docs/stock-disponibilidad-temporal.md §10): no hay devolución
    // de stock en la finalización.
    //  - Reutilizables: nunca se decrementó cantidadDisponible (son puramente
    //    temporales), así que no se repone nada.
    //  - Consumibles: el stock se consumió al ejecutarse y no vuelve.
    // La finalización solo cierra el pedido y sincroniza la reserva.

    // Actualizar estado del pedido
    pedido.estado = "Finalizado";

    registrarHistorial(
      pedido,
      req.usuario.id,
      "FINALIZACION",
      "Pedido finalizado",
      {
        estado: {
          antes: "Aceptado",
          despues: "Finalizado"
        }
      }
    );

    const pedidoFinalizado = await pedido.save();

    // 3. Sincronizar el estado de la Reserva asociada
    await Reserva.findOneAndUpdate(
      { pedidoId: pedido._id },
      { estado: 'Finalizada' }
    );

    // Poblamos para devolver el objeto completo al frontend
    await pedidoFinalizado.populate([
      { path: "docente", select: "nombre apellido email" },
      { path: "laboratorio", select: "nombre tipo" },
      { path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado" }
    ]);

    res.json({ message: "Pedido finalizado. Equipos devueltos a estado disponible.", pedido: pedidoFinalizado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createPedido = async (req, res) => {
  try {
    const { fecha, hora, fechaInicioReal, fechaFinReal, ...resto } = req.body;
    
    // La fechaHora ya viene construida y validada desde el middleware validatePedidos.
    // Guarda defensiva: sin ella calcularVentana fallaría con un error críptico.
    const fechaHora = req.body.fechaHora;

    if (!fechaHora) {
      return res.status(400).json({ error: "fechaHora es obligatorio" });
    }

    if (!validarAnticipacionPedido(fechaHora)) {
      return res.status(400).json({
        error: "No se pueden crear pedidos con menos de 2 horas de anticipación el mismo día o en fechas pasadas"
      });
    }

    if (!resto.duracionClase) {
      return res.status(400).json({ error: "duracionClase es obligatorio" });
    }

    if (!Array.isArray(resto.recursos)) {
      resto.recursos = [];
    }

    const { inicio, fin } = calcularVentana(fechaHora, resto.duracionClase);

    const pedido = new Pedido({
      ...resto,
      fechaHora,
      fechaInicioReal: inicio,
      fechaFinReal: fin,
      detalleProblemas: req.detalleProblemas || [],
      estado: req.estadoCalculado || "Pendiente",
    });

    registrarHistorial(
      pedido,
      req.usuario.id,
      "CREACION",
      "Pedido creado"
    );    

    const nuevo = await pedido.save();

    // Poblamos el pedido recién creado antes de devolverlo
    await nuevo.populate([
      { path: "docente", select: "nombre apellido email" },
      { path: "laboratorio", select: "nombre tipo" },
      { path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado" }
    ]);

    res.status(201).json(nuevo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updatePedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, hora, ...resto } = req.body;

    const actualizacion = { ...resto };

    // =========================
    // FECHA HORA
    // =========================
    if (fecha && hora) {
      actualizacion.fechaHora = new Date(`${fecha}T${hora}`);
    } else if (req.body.fechaHora) {
      actualizacion.fechaHora = new Date(req.body.fechaHora);
    }

    const pedidoDoc = await Pedido.findById(id);

    if (!pedidoDoc) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const pedidoExistente = pedidoDoc.toObject();

    // =========================
    // VALIDACIÓN FECHA
    // =========================
    const fechaBase =
      actualizacion.fechaHora || pedidoExistente.fechaHora;

    if (fechaBase && !validarAnticipacionPedido(new Date(fechaBase))) {
      return res.status(400).json({
        error:
          "No se pueden actualizar pedidos con menos de 2 horas de anticipación el mismo día o en fechas pasadas"
      });
    }

    // =========================
    // RECALCULAR HORARIO
    // =========================
    const duracionBase =
      actualizacion.duracionClase || pedidoExistente.duracionClase;

    if (fechaBase && duracionBase) {
      const { inicio, fin } = calcularVentana(
        new Date(fechaBase),
        duracionBase
      );

      actualizacion.fechaInicioReal = inicio;
      actualizacion.fechaFinReal = fin;
    }

    // =========================
    // DETECCIÓN DE CAMBIOS
    // =========================
    const cambios = {};

    const compararSimple = [
      "materia",
      "alumnos",
      "duracionClase",
      "fechaHora",
      "laboratorio"
    ];

    const normalize = (v) => {
      if (!v) return null;

      if (v instanceof Date) return v.toISOString();

      if (typeof v === "object" && v._id) return v._id.toString();

      return JSON.stringify(v);
    };

    for (const campo of compararSimple) {
      if (actualizacion[campo] === undefined) continue;

      const antes = pedidoExistente[campo];
      const despues = actualizacion[campo];

      if (normalize(antes) !== normalize(despues)) {
        cambios[campo] = {
          antes,
          despues
        };
      }
    }    

    // =========================
    // HORARIO REAL
    // =========================
    if (
      actualizacion.fechaInicioReal &&
      actualizacion.fechaFinReal
    ) {
      const antes = {
        inicio: pedidoExistente.fechaInicioReal,
        fin: pedidoExistente.fechaFinReal
      };

      const despues = {
        inicio: actualizacion.fechaInicioReal,
        fin: actualizacion.fechaFinReal
      };

      if (
        new Date(antes.inicio).getTime() !== new Date(despues.inicio).getTime() ||
        new Date(antes.fin).getTime() !== new Date(despues.fin).getTime()
      ) {
        cambios.horario = { antes, despues };
      }
    }

    // =========================
    // RECURSOS (IMPORTANTE)
    // =========================
    if (actualizacion.recursos) {
      const normalizar = (r) => ({
        recursoId: r.recursoId?.toString?.() || r.recursoId,
        tipoRecurso: r.tipoRecurso,
        cantidad: r.cantidad
      });

      const antesRecursos = (pedidoExistente.recursos || []).map(normalizar);
      const despuesRecursos = (actualizacion.recursos || []).map(normalizar);

      if (
        JSON.stringify(antesRecursos) !== JSON.stringify(despuesRecursos)
      ) {
        cambios.recursos = {
          antes: antesRecursos,
          despues: despuesRecursos
        };
      }
    }

    // =========================
    // HISTORIAL
    // =========================
    if (Object.keys(cambios).length > 0) {
      registrarHistorial(
        pedidoDoc,
        req.usuario.id,
        "MODIFICACION",
        "Se modificó el pedido",
        cambios
      );
    }

    // =========================
    // APLICAR CAMBIOS
    // =========================
    Object.assign(pedidoDoc, actualizacion);

    await pedidoDoc.save();

    await pedidoDoc.populate("docente", "nombre apellido email");
    await pedidoDoc.populate("laboratorio", "nombre tipo");
    await pedidoDoc.populate({
      path: "recursos.recursoId",
      select: "nombre tipo codigo esFijo estado"
    });

    res.json(pedidoDoc);

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (
      ![
        "Pendiente",
        "En Revisión",
        "Aceptado",
        "Rechazado",
        "Finalizado"
      ].includes(estado)
    ) {
      return res.status(400).json({
        error: "Estado no válido"
      });
    }

    const pedido = await Pedido.findById(id);

    if (!pedido) {
      return res.status(404).json({
        error: "Pedido no encontrado"
      });
    }

    if (pedido.estado === estado) {
      return res.status(400).json({
        error: "El pedido ya tiene ese estado"
      });
    }    

    const estadoAnterior = pedido.estado;

    pedido.estado = estado;

    registrarHistorial(
      pedido,
      req.usuario.id,
      "CAMBIO_ESTADO",
      `Estado cambiado de "${estadoAnterior}" a "${estado}"`,
      {
        estado: {
          antes: estadoAnterior,
          despues: estado
        }
      }
    );

    await pedido.save();

    await pedido.populate([
      {
        path: "docente",
        select: "nombre apellido email"
      },
      {
        path: "laboratorio",
        select: "nombre tipo"
      },
      {
        path: "recursos.recursoId",
        select: "nombre tipo codigo esFijo estado"
      }
    ]);

    res.json(pedido);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};

const borrarPedidoLogico = async (req, res) => {
  try {
    const { id } = req.params;

    const pedido = await Pedido.findById(id);

    if (!pedido) {
      return res.status(404).json({
        error: "Pedido no encontrado"
      });
    }

    pedido.activo = false;

    registrarHistorial(
      pedido,
      req.usuario.id,
      "ELIMINACION",
      "Pedido eliminado lógicamente"
    );

    await pedido.save();

    res.json({
      message: "Pedido eliminado lógicamente",
      pedido
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};


const agregarComentario = async (req, res) => {
  try {
    const { id } = req.params;
    const { mensaje } = req.body;

    const pedido = await Pedido.findById(id);

    if (!pedido) {
      return res.status(404).json({
        error: "Pedido no encontrado"
      });
    }

    pedido.comentarios.push({
      usuario: req.usuario.id,
      mensaje
    });

    registrarHistorial(
      pedido,
      req.usuario.id,
      "COMENTARIO",
      "Se agregó un comentario"
    );    

    await pedido.save();

    // Volvemos a buscar el pedido ya guardado
    const pedidoActualizado = await Pedido.findById(id)
      .populate({
        path: "comentarios.usuario",
        select: "nombre apellido rol"
      });

    const comentarioNuevo =
      pedidoActualizado.comentarios[
        pedidoActualizado.comentarios.length - 1
      ];

    res.status(201).json(comentarioNuevo);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const marcarComentariosVistos = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.usuario.id;

    const ahora = new Date();

    const pedido = await Pedido.findById(id);

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const idx = pedido.vistoPor.findIndex(
      v => v.usuario.toString() === userId
    );

    if (idx >= 0) {
      pedido.vistoPor[idx].ultimoComentarioVisto = ahora;
    } else {
      pedido.vistoPor.push({
        usuario: userId,
        ultimoComentarioVisto: ahora
      });
    }

    await Pedido.updateOne(
      { _id: id },
      { $set: { vistoPor: pedido.vistoPor } }
    );

    res.json({ ok: true });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export {
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  updateEstado,
  aprobarPedido,
  finalizarPedido,
  borrarPedidoLogico,
  agregarComentario,
  marcarComentariosVistos,
};