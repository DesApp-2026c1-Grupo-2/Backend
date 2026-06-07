const Pedido = require("../models/pedido.model");
const Lote = require("../models/lote.model");
const Equipo = require("../models/equipo.model");
const Item = require("../models/item.model");
const { verificarConflictos } = require("../services/pedidoConflictos");

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

    const pedido = await Pedido.findOne({ _id: id, activo: { $ne: false } })
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
    
    const pedido = await Pedido.findOne({ _id: id, activo: { $ne: false } });
    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (pedido.estado === "Aceptado") {
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
    for (const r of pedido.recursos) {
      const ref = r.modeloRef || r.tipoRecurso;
      
      if (ref === "Equipo") {
        await Equipo.findByIdAndUpdate(r.recursoId, { estado: "reservado" });
      } else if (ref === "Item") {
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

    // 3. Actualizar estado del pedido
    pedido.estado = "Aceptado";
    const pedidoAprobado = await pedido.save();

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
    
    const pedido = await Pedido.findOne({ _id: id, activo: { $ne: false } });
    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (pedido.estado !== "Aceptado") {
      return res.status(400).json({ error: "El pedido debe estar en estado 'Aceptado' para poder finalizarse." });
    }

    // 1. Proceder con la liberación de los equipos
    for (const r of pedido.recursos) {
      const ref = r.modeloRef || r.tipoRecurso;
      
      if (ref === "Equipo") {
        await Equipo.findByIdAndUpdate(r.recursoId, { estado: "disponible" });
      } else if (ref === "Item") {
        const item = await Item.findById(r.recursoId);
        // Solo reponemos los ítems que NO son consumibles (ej. materiales como tubos de ensayo)
        if (item && item.esConsumible === false && r.lotesDescontados && r.lotesDescontados.length > 0) {
          for (const loteDesc of r.lotesDescontados) {
            await Lote.findByIdAndUpdate(loteDesc.loteId, {
              $inc: { cantidadDisponible: loteDesc.cantidadDescontada }
            });
          }
        }
      }
    }

    // 2. Actualizar estado del pedido
    pedido.estado = "Finalizado";
    const pedidoFinalizado = await pedido.save();

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
    const { fecha, hora, ...resto } = req.body;
    
    // Combinar fecha y hora en un objeto Date
    let fechaHora;
    if (fecha && hora) {
      fechaHora = new Date(`${fecha}T${hora}`);
    } else if (req.body.fechaHora) {
      fechaHora = req.body.fechaHora;
    } else {
      return res.status(400).json({ error: "fechaHora es obligatorio" });
    }

    const pedido = new Pedido({
      ...resto,
      fechaHora,
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
    const { fecha, hora, ...resto } = req.body;
    
    // Combinar fecha y hora si vienen separadas
    const actualizacion = { ...resto };
    if (fecha && hora) {
      actualizacion.fechaHora = new Date(`${fecha}T${hora}`);
    } else if (req.body.fechaHora) {
      actualizacion.fechaHora = req.body.fechaHora;
    }

    const pedido = await Pedido.findOneAndUpdate(
      { _id: id, activo: { $ne: false } },
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

    const pedido = await Pedido.findOneAndUpdate(
      { _id: id, activo: { $ne: false } },
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
    const pedido = await Pedido.findOneAndUpdate(
      { _id: id, activo: { $ne: false } },
      { activo: false },
      { new: true }
    );

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    res.json({ message: "Pedido marcado como eliminado (borrado lógico)", pedido });
  } catch (error) {
    res.status(400).json({ error: error.message });
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

    await pedido.populate(
      "comentarios.usuario",
      "nombre apellido rol"
    );

    res.status(201).json(
      pedido.comentarios[pedido.comentarios.length - 1]
    );

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};
module.exports = {
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