import mongoose from "mongoose";
import Equipo from "../models/equipo.model.js";
import { obtenerEstadisticasUso } from "../services/estadisticasEquipo.js";
import { parsePaginacion } from "../utils/paginacion.js";

const createEquipo = async (req, res) => {
  try {
    const equipo = new Equipo(req.body);
    await equipo.save();

    return res.status(201).json(equipo);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "El código de equipo ya existe." });
    }
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: "Error interno del servidor", detalles: err.message });
  }
};


const getEquipos = async (req, res) => {
  try {
    const { estado, edificioId, laboratorioId, q } = req.query;

    const filtros = { activo: { $ne: false } };

    if (estado) filtros.estado = estado;

    if (edificioId === "null") {
      filtros.edificioId = null;
    } else if (edificioId) {
      filtros.edificioId = new mongoose.Types.ObjectId(edificioId);
    }

    if (laboratorioId === "null") {
      filtros.laboratorioId = null;
    } else if (laboratorioId) {
      filtros.laboratorioId = new mongoose.Types.ObjectId(laboratorioId);
    }

    if (q) {
      // Búsqueda parcial case-insensitive sobre nombre o código (texto literal).
      const termino = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filtros.$or = [{ nombre: termino }, { codigo: termino }];
    }

    const { page, limit, skip } = parsePaginacion(req.query, { def: 20, max: 100 });

    const [equipos, total] = await Promise.all([
      Equipo.find(filtros)
        .sort({ nombre: 1 })
        .skip(skip)
        .limit(limit)
        .populate("edificioId")
        .populate("laboratorioId"),
      Equipo.countDocuments(filtros),
    ]);

    return res.json({ total, page, limit, equipos });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "Formato de ID inválido en los parámetros de búsqueda." });
    }
    return res.status(500).json({ error: "Error al obtener los equipos", detalles: err.message });
  }
};


const getEquipoById = async (req, res) => {
  try {
    const { id } = req.params;

    const equipo = await Equipo.findOne({ _id: id, activo: { $ne: false } })
      .populate("edificioId")
      .populate("laboratorioId");

    if (!equipo) {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    return res.json(equipo);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "El ID proporcionado no tiene un formato válido." });
    }
    return res.status(500).json({ error: "Error al obtener el equipo", detalles: err.message });
  }
};


const updateEquipo = async (req, res) => {
  try {
    const { id } = req.params;

    const equipo = await Equipo.findOne({ _id: id, activo: { $ne: false } });
    if (!equipo) {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    Object.assign(equipo, req.body);
    
    await equipo.save();

    return res.json(equipo);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "El código de equipo ya existe." });
    }
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: "Error interno del servidor", detalles: err.message });
  }
};


const deleteEquipo = async (req, res) => {
  try {
    const { id } = req.params;

    const equipo = await Equipo.findOneAndUpdate(
      { _id: id, activo: { $ne: false } },
      { activo: false },
      { new: true }
    );

    if (!equipo) {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    return res.json({ message: "Equipo marcado como eliminado (borrado lógico)", equipo });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "El ID proporcionado no tiene un formato válido." });
    }
    return res.status(500).json({ error: "Error al eliminar el equipo", detalles: err.message });
  }
};

const getEstadisticasUso = async (req, res) => {
  try {
    // Joi (validate 'query') ya aplicó defaults y coerción de tipos.
    const { periodo, fecha, laboratorioId, equipoId, page, limit } = req.query;

    const resultado = await obtenerEstadisticasUso({
      periodo,
      fecha,
      laboratorioId,
      equipoId,
      page,
      limit,
    });

    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({
      error: "Error al obtener las estadísticas de uso de equipos",
      detalles: err.message,
    });
  }
};

export {
    deleteEquipo,
    updateEquipo,
    getEquipoById,
    getEquipos,
    createEquipo,
    getEstadisticasUso
}