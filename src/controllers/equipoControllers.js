const mongoose = require("mongoose");
const Equipo = require("../models/equipo.model");

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
    const { estado, edificioId, laboratorioId } = req.query;

    const filtros = { activo: { $ne: false } };

    if (estado) filtros.estado = estado;
    if (edificioId) filtros.edificioId = new mongoose.Types.ObjectId(edificioId);
    if (laboratorioId) filtros.laboratorioId = new mongoose.Types.ObjectId(laboratorioId);

    const equipos = await Equipo.find(filtros)
      .populate("edificioId")
      .populate("laboratorioId");

    return res.json(equipos);
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

module.exports = {
    deleteEquipo,
    updateEquipo,
    getEquipoById,
    getEquipos,
    createEquipo
}