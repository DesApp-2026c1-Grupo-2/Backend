const Pedido = require("../models/pedido.model");
const Laboratorio = require("../models/laboratorio.model");
const Equipo = require("../models/equipo.model");
const pedidoSchemaJoi = require("../schemas/pedidoSchema");

const equiposDisponibles = {
  "Micropipetas P200": 10,
  "Espectrofotómetro UV": 2,
  "Centrífuga de mesa": 3,
};

const materialesStock = {
  "Tubos eppendorf": 50,
  "Pipetas": 100,
};

const reactivosStock = {
  "Buffer de lisis": 20,
  "Ácido nítrico": 20,
  "Colorante": 30,
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeLaboratorioNombre = (nombre = "") =>
  nombre.replace(/\(.*\)$/, "").trim();

const validarPedido = async (req, res, next) => {
  try {
    const data = req.body;
    const problemas = [];

    const { error } = pedidoSchemaJoi.validate(data, { abortEarly: false });
    if (error) {
      return res.status(400).json({ errores: error.details.map((d) => d.message) });
    }

    const providedLabName = data.laboratorio;
    const normalizedLabName = normalizeLaboratorioNombre(providedLabName);

    let lab = await Laboratorio.findOne({ nombre: providedLabName });
    if (!lab && normalizedLabName !== providedLabName) {
      lab = await Laboratorio.findOne({ nombre: normalizedLabName });
    }
    if (!lab) {
      lab = await Laboratorio.findOne({ nombre: { $regex: `^${escapeRegex(normalizedLabName)}`, $options: "i" } });
    }

    if (!lab) {
      return res.status(400).json({ errores: ["El laboratorio no existe"] });
    }

    if (lab.estado !== "disponible") {
      problemas.push(`El laboratorio '${lab.nombre}' no está disponible actualmente`);
    }

    if (data.alumnos > lab.capacidad) {
      problemas.push(`El laboratorio ${lab.nombre} tiene capacidad máxima de ${lab.capacidad} alumnos`);
    }

    const filtroConflicto = {
      laboratorio: lab.nombre,
      fecha: data.fecha,
      hora: data.hora,
      estado: { $ne: "Rechazado" },
    };

    if (req.params.id) {
      filtroConflicto._id = { $ne: req.params.id };
    }

    const existe = await Pedido.findOne(filtroConflicto);
    if (existe) {
      problemas.push("El laboratorio ya está ocupado en ese horario");
    }

    for (const recurso of data.recursos || []) {
      if (recurso.tipo === "Equipo") {
        const cantidadDisponibleDB = await Equipo.countDocuments({
          nombre: recurso.nombre,
          estado: "disponible",
        });
        const cantidadDisponible =
          cantidadDisponibleDB > 0 ? cantidadDisponibleDB : equiposDisponibles[recurso.nombre] || 0;

        if (cantidadDisponible < recurso.cantidad) {
          problemas.push(`No hay suficientes equipos disponibles para ${recurso.nombre}`);
        }
      }

      if (recurso.tipo === "Material") {
        if (!materialesStock[recurso.nombre] || materialesStock[recurso.nombre] < recurso.cantidad) {
          problemas.push(`Stock insuficiente de material: ${recurso.nombre}`);
        }
      }

      if (recurso.tipo === "Reactivo") {
        if (!reactivosStock[recurso.nombre] || reactivosStock[recurso.nombre] < recurso.cantidad) {
          problemas.push(`Stock insuficiente de reactivo: ${recurso.nombre}`);
        }
      }
    }

    if (problemas.length > 0) {
      return res.status(400).json({ errores: problemas });
    }

    req.estadoCalculado = "Pendiente";
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = validarPedido;