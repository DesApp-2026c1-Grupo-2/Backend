const Pedido = require("../models/pedido.model");
const Laboratorio = require("../models/laboratorio.model");
const Equipo = require("../models/equipo.model");
const Item = require("../models/item.model");
const Lote = require("../models/lote.model");

const construirFechaHora = (data) => {
  if (data.fecha && data.hora) {
    return new Date(`${data.fecha}T${data.hora}`);
  }
  if (data.fechaHora) {
    return new Date(data.fechaHora);
  }
  return null;
};

const validarFechaHora = (fechaHora) => {
  if (!fechaHora || isNaN(fechaHora.getTime())) {
    throw new Error("La fecha y hora proporcionadas son inválidas");
  }
};

const validarConflictoLaboratorio = async (data, fechaHora, pedidoId) => {
  const filtroConflicto = {
    laboratorio: data.laboratorio,
    fechaHora,
    estado: { $ne: "Rechazado" },
    activo: { $ne: false },
  };

  if (pedidoId) {
    filtroConflicto._id = { $ne: pedidoId };
  }

  const existe = await Pedido.findOne(filtroConflicto);
  if (existe) {
    return "El laboratorio ya está ocupado en ese horario";
  }
  return null;
};

const validarLaboratorioCapacidad = async (data) => {
  const laboratorio = await Laboratorio.findById(data.laboratorio);

  if (!laboratorio) {
    return "El laboratorio solicitado no existe en la base de datos.";
  }

  if (typeof data.alumnos === "number" && data.alumnos > laboratorio.capacidad) {
    return `El laboratorio no tiene capacidad suficiente (Máximo: ${laboratorio.capacidad} alumnos).`;
  }

  return null;
};

const validarRecursoEquipo = async (recurso) => {
  const equipo = await Equipo.findById(recurso.recursoId);
  if (!equipo) {
    return "Uno de los equipos solicitados no existe.";
  }
  if (equipo.estado !== "disponible") {
    return `El equipo '${equipo.nombre}' no está disponible (Estado actual: ${equipo.estado}).`;
  }
  return null;
};

const validarRecursoItem = async (recurso) => {
  const item = await Item.findById(recurso.recursoId);
  if (!item) {
    return "Uno de los ítems solicitados no existe.";
  }

  const stockDisponible = await Lote.calcularStockDisponible(recurso.recursoId);
  if (stockDisponible < recurso.cantidad) {
    return `Stock insuficiente de '${item.nombre}'. Solicitado: ${recurso.cantidad}, Disponible: ${stockDisponible}.`;
  }
  return null;
};

const validarRecursos = async (data) => {
  const detalles = [];

  if (!Array.isArray(data.recursos) || data.recursos.length === 0) {
    detalles.push("El pedido debe contener al menos un recurso.");
    return detalles;
  }

  for (const recurso of data.recursos) {
    if (!recurso.tipoRecurso || !recurso.recursoId || !recurso.cantidad) {
      detalles.push("Cada recurso debe incluir tipoRecurso, recursoId y cantidad.");
      continue;
    }

    if (recurso.tipoRecurso === "Equipo") {
      const problema = await validarRecursoEquipo(recurso);
      if (problema) detalles.push(problema);
      continue;
    }

    if (recurso.tipoRecurso === "Item") {
      const problema = await validarRecursoItem(recurso);
      if (problema) detalles.push(problema);
      continue;
    }

    detalles.push(`Tipo de recurso no válido: ${recurso.tipoRecurso}`);
  }

  return detalles;
};

const validarPedido = async (req, res, next) => {
  try {
    const data = req.body;
    const detalleProblemas = [];
    const fechaHora = construirFechaHora(data);

    validarFechaHora(fechaHora);
    req.body.fechaHora = fechaHora;

    const conflicto = await validarConflictoLaboratorio(data, fechaHora, req.params.id);
    if (conflicto) detalleProblemas.push(conflicto);

    const problemaLaboratorio = await validarLaboratorioCapacidad(data);
    if (problemaLaboratorio) detalleProblemas.push(problemaLaboratorio);

    const recursosProblemas = await validarRecursos(data);
    detalleProblemas.push(...recursosProblemas);

    req.detalleProblemas = detalleProblemas;
    req.estadoCalculado = detalleProblemas.length > 0 ? "En Revisión" : "Pendiente";

    next();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = validarPedido;