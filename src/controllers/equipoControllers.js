const Equipo = require("../models/equipo.model");
const equipoSchemaJoi  = require("../schemas/equipoSchema");

const createEquipo = async (req, res) => {
  try {
    const { error, value } = equipoSchemaJoi.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const equipo = new Equipo(value);
    await equipo.save();

    return res.status(201).json(equipo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


const getEquipos = async (req, res) => {
  try {
    const { estado, edificioId, laboratorioId } = req.query;

    const filtros = {};

    if (estado) filtros.estado = estado;
    if (edificioId) filtros.edificioId = edificioId;
    if (laboratorioId) filtros.laboratorioId = laboratorioId;

    const equipos = await Equipo.find(filtros)
      .populate("edificioId")
      .populate("laboratorioId");

    return res.json(equipos);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


const getEquipoById = async (req, res) => {
  try {
    const { id } = req.params;

    const equipo = await Equipo.findById(id)
      .populate("edificioId")
      .populate("laboratorioId");

    if (!equipo) {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    return res.json(equipo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


const updateEquipo = async (req, res) => {
  try {
    const { id } = req.params;

    const { error, value } = equipoSchemaJoi.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const equipo = await Equipo.findById(id);
    if (!equipo) {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    Object.assign(equipo, value);
    await equipo.save();

    return res.json(equipo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


const deleteEquipo = async (req, res) => {
  try {
    const { id } = req.params;

    const equipo = await Equipo.findByIdAndDelete(id);

    if (!equipo) {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    return res.json({ message: "Equipo eliminado correctamente" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
    deleteEquipo,
    updateEquipo,
    getEquipoById,
    getEquipos,
    createEquipo
}