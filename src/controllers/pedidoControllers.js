import Pedido from "../models/pedido.model.js";
import Equipo from "../models/equipo.model.js";
import Item from "../models/item.model.js";
import Lote from "../models/lote.model.js"; // <-- Agregado para que no falle el descarte de stock
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
        select: "nombre tipo codigo esFijo estado laboratorio",
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
        select: "nombre tipo codigo esFijo estado laboratorio",
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

    await Reserva.deleteOne({ pedidoId: pedido._id });

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
      await Reserva.deleteOne({ _id: nuevaReserva._id });
      throw saveErr;
    }

    await pedidoAprobado.populate([
      { path: "docente", select: "nombre apellido email" },
      { path: "laboratorio", select: "nombre tipo" },
      { path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado laboratorio" }
    ]);

    res.json({ message: "Pedido aprobado. Reserva creada y disponibilidad confirmada.", pedido: pedidoAprobado, reservaId: nuevaReserva._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const finalizarPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { descartes, desperfectos } = req.body; 
    
    const pedido = await Pedido.findById(id);
    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (pedido.estado !== "Aceptado") {
      return res.status(400).json({ error: "El pedido debe estar en estado 'Aceptado' para poder finalizarse." });
    }

    // 1. Registrar Descartes de Materiales/Reactivos (Baja física en Lotes)
    if (descartes && descartes.length > 0) {
      for (const descarte of descartes) {
        await Lote.findByIdAndUpdate(descarte.loteId, {
          $inc: { cantidadDisponible: -descarte.cantidadADescartar }
        });
        
        // Guardamos constancia en texto dentro de detalleProblemas respetando tu Schema estricto
        pedido.detalleProblemas.push(
          `Descarte - Lote ID: ${descarte.loteId}, Cantidad: ${descarte.cantidadADescartar}, Motivo: ${descarte.motivo || "No especificado"}`
        );
      }
    }

    // 2. Registrar Desperfectos de Equipos (Cambiar estado a 'Mantenimiento')
    if (desperfectos && desperfectos.length > 0) {
      for (const equipoId of desperfectos) {
        await Equipo.findByIdAndUpdate(equipoId, { estado: "Mantenimiento" }); 
        pedido.detalleProblemas.push(`Desperfecto - Equipo ID: ${equipoId} enviado a Mantenimiento.`);
      }
    }

    // 3. Guardar cambios de estado e historial
    pedido.estado = "Finalizado";

    registrarHistorial(
      pedido,
      req.usuario.id,
      "FINALIZACION",
      "Pedido finalizado con reporte de uso.",
      { 
        cambios: { 
          estado: { antes: "Aceptado", despues: "Finalizado" },
          reporteFinal: { descartes, desperfectos } // Se guarda seguro acá porque cambios es Tipo Mixed
        } 
      }
    );

    const pedidoFinalizado = await pedido.save();
    
    await Reserva.findOneAndUpdate({ pedidoId: pedido._id }, { estado: 'Finalizada' });

    await pedidoFinalizado.populate([
      { path: "docente", select: "nombre apellido email" },
      { path: "laboratorio", select: "nombre tipo" },
      { path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado" }
    ]);

    res.json({ message: "Pedido finalizado y novedades registradas.", pedido: pedidoFinalizado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createPedido = async (req, res) => {
  try {
    const { fecha, hora, fechaInicioReal, fechaFinReal, ...resto } = req.body;
    
    const fechaHora = req.body.fechaHora;

    if (!fechaHora) {
      return res.status(400).json({ error: "fechaHora es obligatorio" });
    }

    if (!validarAnticipacionPedido(fechaHora)) {
      return res.status(400).json({
        error: "No se pueden crear pedidos con menos de 2 hours de anticipación el mismo día o en fechas pasadas"
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

    await nuevo.populate([
      { path: "docente", select: "nombre apellido email" },
      { path: "laboratorio", select: "nombre tipo" },
      { path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado laboratorio" }
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

    const fechaBase =
      actualizacion.fechaHora || pedidoExistente.fechaHora;

    if (fechaBase && !validarAnticipacionPedido(new Date(fechaBase))) {
      return res.status(400).json({
        error:
          "No se pueden actualizar pedidos con menos de 2 hours de anticipación el mismo día o en fechas pasadas"
      });
    }

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

    if (Object.keys(cambios).length > 0) {
      registrarHistorial(
        pedidoDoc,
        req.usuario.id,
        "MODIFICACION",
        "Se modificó el pedido",
        changes
      );
    }

    Object.assign(pedidoDoc, actualizacion);

    await pedidoDoc.save();

    await pedidoDoc.populate("docente", "nombre apellido email");
    await pedidoDoc.populate("laboratorio", "nombre tipo");
    await pedidoDoc.populate({
      path: "recursos.recursoId",
      select: "nombre tipo codigo esFijo estado laboratorio",
    });

    res.json(pedidoDoc);

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivoRechazo } = req.body; // <-- Corregido: extraemos todo acá arriba juntos

    const estadosValidos = [
      "Pendiente",
      "Aceptado",
      "Rechazado",
      "Finalizado",
      "Cancelado",
      "Expirado"
    ];

    if (!estadosValidos.includes(estado)) {
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

    if (estado === "Cancelado") {
      if (!["Pendiente", "Aceptado"].includes(estadoAnterior)) {
        return res.status(400).json({ error: "Solo se pueden cancelar pedidos en estado Pendiente o Aceptado." });
      }

      if (estadoAnterior === "Aceptado") {
        await Reserva.findOneAndUpdate(
          { pedidoId: pedido._id },
          { estado: 'Cancelada' }
        );
      }
    }

    pedido.estado = estado;

    if (estado === "Rechazado") {
      pedido.motivoRechazo = motivoRechazo || "Sin motivo especificado";
    }

    registrarHistorial(
      pedido,
      req.usuario.id,
      "CAMBIO_ESTADO",
      `Estado cambiado de "${estadoAnterior}" a "${estado}"` + (estado === "Rechazado" ? `. Motivo: ${pedido.motivoRechazo}` : ""),
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
        select: "nombre tipo codigo esFijo estado laboratorio",
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

export const updateChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const { checklist } = req.body; // Recibe el array modificado desde el frontend

    // Actualizamos el campo checklist y devolvemos el pedido actualizado
    // Nota: Agregá los .populate() que uses normalmente en tu "getPedidoById" 
    // para que la UI no pierda los datos de docente o laboratorio al refrescar el estado.
    const pedidoActualizado = await Pedido.findByIdAndUpdate(
      id,
      { $set: { checklist } },
      { new: true }
    ).populate("docente").populate("laboratorio"); 

    if (!pedidoActualizado) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Devolvemos el pedido completo para que el frontend actualice su estado local
    res.json(pedidoActualizado);
  } catch (error) {
    console.error("Error al actualizar checklist:", error);
    res.status(500).json({ error: "Error interno al actualizar la checklist" });
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