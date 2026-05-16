const Pedido = require("../models/pedido.model");
const Laboratorio = require("../models/laboratorio.model");
const Equipo = require("../models/equipo.model");
const Item = require("../models/item.model");
const Lote = require("../models/lote.model");

const validarPedido = async (req, res, next) => {
  try {
    const data = req.body;
    const detalleProblemas = [];

    // 1. Construir fechaHora a partir de fecha y hora si es necesario
    let fechaHora;
    if (data.fecha && data.hora) {
      fechaHora = new Date(`${data.fecha}T${data.hora}`);
    } else if (data.fechaHora) {
      fechaHora = new Date(data.fechaHora);
    }

    if (!fechaHora || isNaN(fechaHora.getTime())) {
      return res.status(400).json({ error: "La fecha y hora proporcionadas son inválidas" });
    }
    
    // Exponemos la fecha construida por si se necesita más adelante
    req.body.fechaHora = fechaHora;

    // 2. Verificar que no haya conflicto de horario en el laboratorio
    const filtroConflicto = {
      laboratorio: data.laboratorio,
      fechaHora: fechaHora,
      estado: { $ne: "Rechazado" },
    };
    const existe = await Pedido.findOne(filtroConflicto);

    if (existe) {
      detalleProblemas.push("El laboratorio ya está ocupado en ese horario");
    }

    // 3. Validar existencia y capacidad del laboratorio
    const lab = await Laboratorio.findById(data.laboratorio);
    if (!lab) {
      detalleProblemas.push("El laboratorio solicitado no existe en la base de datos.");
    } else if (data.alumnos > lab.capacidad) {
      detalleProblemas.push(`El laboratorio no tiene capacidad suficiente (Máximo: ${lab.capacidad} alumnos).`);
    }

    // 4. Validar existencia y disponibilidad real de los recursos
    if (data.recursos && Array.isArray(data.recursos)) {
      for (const r of data.recursos) {
        if (r.tipoRecurso === "Equipo") {
          const equipo = await Equipo.findById(r.recursoId);
          if (!equipo) {
            detalleProblemas.push("Uno de los equipos solicitados no existe.");
          } else if (equipo.estado !== "disponible") {
            // Nota: Podrías validar también la cantidad si manejas "modelos" de equipos en lugar de instancias únicas,
            // pero asumiendo que un Equipo representa un objeto físico, chequeamos su estado.
            detalleProblemas.push(`El equipo '${equipo.nombre}' no está disponible (Estado actual: ${equipo.estado}).`);
          }
        }

        if (r.tipoRecurso === "Item") {
          const item = await Item.findById(r.recursoId);
          if (!item) {
            detalleProblemas.push("Uno de los ítems solicitados no existe.");
          } else {
            // Delegamos el cálculo del stock real al modelo de Lote
            const stockDisponible = await Lote.calcularStockDisponible(r.recursoId);
            if (stockDisponible < r.cantidad) {
              detalleProblemas.push(
                `Stock insuficiente de '${item.nombre}'. Solicitado: ${r.cantidad}, Disponible: ${stockDisponible}.`
              );
            }
          }
        }
      }
    }

    req.detalleProblemas = detalleProblemas;
    req.estadoCalculado =
      detalleProblemas.length > 0 ? "En Revisión" : "Pendiente";

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = validarPedido;