import Pedido from "../models/pedido.model.js";
import Lote from "../models/lote.model.js";
import Equipo from "../models/equipo.model.js";
import Item from "../models/item.model.js";
import { verificarConflictos } from "../services/pedidoConflictos.js";
import Descarte from "../models/descarte.model.js";
import Reserva from "../models/reserva.model.js";
import { calcularVentana } from "../services/fechasReserva.js";
import { validarAnticipacionPedido } from "../services/pedidoValidaciones.js";

const getPedidos = async (req, res) => {
  try {

    const { id, rol } = req.usuario;

    let filtro = { activo: { $ne: false } };

    // DOCENTE → solo sus pedidos
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
      .sort({ fechaHora: -1 });

    res.json(pedidos);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
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

    // 2. Proceder con el descuento de stock en Lotes y reserva de Equipos
    const checklist = [];
    let requiereCarrito = false;

    for (const r of pedido.recursos) {
      const ref = r.modeloRef || r.tipoRecurso;
      
      if (ref === "Equipo") {
        requiereCarrito = true;
        checklist.push({
          descripcion: "Acondicionar equipo reservado y verificar su funcionamiento.",
          tipo: "Logistica"
        });
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

        let cantidadRestante = r.cantidad;
        
        // Inicializamos el arreglo para guardar el registro de qué lotes tocamos
        r.lotesDescontados = [];

        // Estrategia FIFO: traer lotes disponibles ordenados por Vencimiento y Creación
        const lotes = await Lote.find({ 
          itemId: r.recursoId, 
          estado: "disponible",
          cantidadDisponible: { $gt: 0 } 
        }).sort({ fechaVencimiento: 1, fechaCreacion: 1 });

        for (const lote of lotes) {
          if (cantidadRestante <= 0) break; // Ya descontamos todo lo necesario

          let descontado = 0;
          if (lote.cantidadDisponible >= cantidadRestante) {
            descontado = cantidadRestante;
            lote.cantidadDisponible -= cantidadRestante;
            cantidadRestante = 0;
          } else {
            // El lote no alcanza a cubrir toda la cantidad, lo vaciamos y seguimos con el próximo
            descontado = lote.cantidadDisponible;
            cantidadRestante -= lote.cantidadDisponible;
            lote.cantidadDisponible = 0;
          }
          
          r.lotesDescontados.push({
            loteId: lote._id,
            cantidadDescontada: descontado
          });

          await lote.save();
        }
      }
    }

    if (requiereCarrito) {
      checklist.push({
        descripcion: "Colocar todos los materiales, equipos y reactivos en los carritos destinados al aula.",
        tipo: "General"
      });
    }

    // 3. Actualizar estado del pedido
    pedido.estado = "Aceptado";
    pedido.checklist = checklist;
    const pedidoAprobado = await pedido.save();

    // 4. Crear la Reserva asociada de forma automática
    const equiposReservados = [];
    const materialesReservados = [];

    for (const r of pedido.recursos) {
      const ref = r.modeloRef || r.tipoRecurso;
      if (ref === "Equipo") {
        equiposReservados.push({ equipoId: r.recursoId });
      } else if (ref === "Item") {
        materialesReservados.push({
          itemId: r.recursoId,
          cantidadTotal: r.cantidad,
          lotesUsados: r.lotesDescontados ? r.lotesDescontados.map(l => ({
            loteId: l.loteId,
            cantidad: l.cantidadDescontada
          })) : []
        });
      }
    }

    const nuevaReserva = new Reserva({
      pedidoId: pedidoAprobado._id,
      laboratorioId: pedidoAprobado.laboratorio,
      docenteId: pedidoAprobado.docente,
      fechaHora: pedidoAprobado.fechaHora,
      duracionClase: pedidoAprobado.duracionClase,
      equiposReservados,
      materialesReservados
    });
    await nuevaReserva.save();

    // Poblamos para devolver el objeto completo al frontend
    await pedidoAprobado.populate([
      { path: "docente", select: "nombre apellido email" },
      { path: "laboratorio", select: "nombre tipo" },
      { path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado" }
    ]);

    res.json({ message: "Pedido aprobado. Stock descontado y equipos reservados correctamente.", pedido: pedidoAprobado });
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

    // 1. Obtener descartes para calcular cuánto no debe regresar a inventario
    const descartes = await Descarte.find({ pedidoId: id });
    const lotesDescartados = {};
    for (const d of descartes) {
      if (d.tipo !== "equipo" && d.lotesAfectados) {
        for (const la of d.lotesAfectados) {
          const lId = la.loteId.toString();
          lotesDescartados[lId] = (lotesDescartados[lId] || 0) + la.cantidad;
        }
      }
    }

    // 2. Proceder con la liberación de los equipos y materiales
    for (const r of pedido.recursos) {
      const ref = r.modeloRef || r.tipoRecurso;
      
      if (ref === "Equipo") {
      } else if (ref === "Item") {
        const item = await Item.findById(r.recursoId);
        // Solo reponemos los ítems que NO son consumibles (ej. materiales como tubos de ensayo)
        if (item && item.esConsumible === false && r.lotesDescontados && r.lotesDescontados.length > 0) {
          for (const loteDesc of r.lotesDescontados) {
            const loteIdStr = loteDesc.loteId.toString();
            const cantidadDescartada = lotesDescartados[loteIdStr] || 0;
            const aDevolver = Math.max(0, loteDesc.cantidadDescontada - cantidadDescartada);

            if (aDevolver > 0) {
              await Lote.findByIdAndUpdate(loteDesc.loteId, {
                $inc: { cantidadDisponible: aDevolver }
              });
            }
          }
        }
      }
    }

    // 3. Actualizar estado del pedido
    pedido.estado = "Finalizado";
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
    
    // Combinar fecha y hora en un objeto Date
    let fechaHora;
    if (fecha && hora) {
      fechaHora = new Date(`${fecha}T${hora}`);
    } else if (req.body.fechaHora) {
      fechaHora = new Date(req.body.fechaHora);
    } else {
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

    if (!resto.recursos || resto.recursos.length === 0) {
      return res.status(400).json({ error: "Un pedido debe tener al menos un recurso" });
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
    const { fecha, hora, fechaInicioReal, fechaFinReal, ...resto } = req.body;
    
    // Combinar fecha y hora si vienen separadas
    const actualizacion = { ...resto };
    if (fecha && hora) {
      actualizacion.fechaHora = new Date(`${fecha}T${hora}`);
    } else if (req.body.fechaHora) {
      actualizacion.fechaHora = new Date(req.body.fechaHora);
    }

    const pedidoExistente = await Pedido.findById(id);
    if (!pedidoExistente) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const fechaBase = actualizacion.fechaHora || pedidoExistente.fechaHora;

    if (fechaBase && !validarAnticipacionPedido(new Date(fechaBase))) {
      return res.status(400).json({
        error: "No se pueden actualizar pedidos a menos de 2 horas de anticipación el mismo día o a fechas pasadas"
      });
    }

    const duracionBase = actualizacion.duracionClase || pedidoExistente.duracionClase;

    if (fechaBase && duracionBase) {
      const { inicio, fin } = calcularVentana(new Date(fechaBase), duracionBase);
      actualizacion.fechaInicioReal = inicio;
      actualizacion.fechaFinReal = fin;
    }

    const pedido = await Pedido.findByIdAndUpdate(
      id,
      actualizacion,
      { new: true, runValidators: true }
    )
      .populate("docente", "nombre apellido email")
      .populate("laboratorio", "nombre tipo")
      .populate({
        path: "recursos.recursoId",
        select: "nombre tipo codigo esFijo estado",
      });

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    res.json(pedido);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
const updateEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!["Pendiente", "En Revisión", "Aceptado", "Rechazado", "Finalizado"].includes(estado)) {
      return res.status(400).json({ error: "Estado no válido" });
    }

    const pedido = await Pedido.findByIdAndUpdate(
      id,
      { estado },
      { new: true, runValidators: true }
    )
      .populate("docente", "nombre apellido email")
      .populate("laboratorio", "nombre tipo")
      .populate({
        path: "recursos.recursoId",
        select: "nombre tipo codigo esFijo estado",
      });

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    res.json(pedido);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const borrarPedidoLogico = async (req, res) => {
  try {
    const { id } = req.params;
    const pedido = await Pedido.findByIdAndUpdate(
      id,
      { activo: false },
      { new: true }
    );
    
    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    
    res.json({ message: "Pedido eliminado lógicamente", pedido });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
};