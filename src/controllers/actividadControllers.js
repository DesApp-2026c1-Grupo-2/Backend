const Actividad = require("../models/actividad.model");

// C: Crear una nueva actividad
const createActividad = async (req, res) => {
  try {
    const nuevaActividad = new Actividad(req.body);
    const actividadGuardada = await nuevaActividad.save();
    
    return res.status(201).json(actividadGuardada);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// R: Obtener todas las actividades (con filtros opcionales)
const getActividades = async (req, res) => {
  try {
    const { estado } = req.query;
    const filtros = {};

    if (estado) filtros.estado = estado;

    const actividades = await Actividad.find(filtros);
      
    return res.status(200).json(actividades);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// R: Obtener una actividad por su ID
const getActividadById = async (req, res) => {
  try {
    const { id } = req.params;
    const actividad = await Actividad.findById(id);
    
    if (!actividad) {
      return res.status(404).json({ error: "Actividad no encontrada" });
    }
    
    return res.status(200).json(actividad);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// U: Actualizar una actividad
const updateActividad = async (req, res) => {
  try {
    const { id } = req.params;
    
    const actividadActualizada = await Actividad.findByIdAndUpdate(id, req.body, { 
      new: true, 
      runValidators: true 
    });

    if (!actividadActualizada) {
      return res.status(404).json({ error: "Actividad no encontrada" });
    }

    return res.status(200).json(actividadActualizada);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// D: Eliminar una actividad
const deleteActividad = async (req, res) => {
  try {
    const { id } = req.params;
    const actividadEliminada = await Actividad.findByIdAndDelete(id);

    if (!actividadEliminada) {
      return res.status(404).json({ error: "Actividad no encontrada" });
    }

    return res.status(200).json({ message: "Actividad eliminada correctamente" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createActividad,
  getActividades,
  getActividadById,
  updateActividad,
  deleteActividad
};