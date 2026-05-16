const ProduccionReactivo = require("../models/produccionReactivo.model");

// C: Crear un nuevo registro de producción de reactivo
const createProduccionReactivo = async (req, res) => {
  try {
    const nuevaProduccion = new ProduccionReactivo(req.body);
    const produccionGuardada = await nuevaProduccion.save();
    
    return res.status(201).json(produccionGuardada);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// R: Obtener todos los registros de producción (con filtros opcionales)
const getProduccionesReactivos = async (req, res) => {
  try {
    const { reactivoId, actividadId } = req.query;
    const filtros = {};

    if (reactivoId) filtros.reactivoId = reactivoId;
    if (actividadId) filtros.actividadId = actividadId;

    const producciones = await ProduccionReactivo.find(filtros)
      .populate('reactivoId', 'nombre codigo tipo unidad')
      .populate('composicionReal.sustanciaId', 'nombre codigo tipo unidad')
      .populate('actividadId', 'nombre estado');
      
    return res.status(200).json(producciones);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// R: Obtener un registro de producción por su ID
const getProduccionReactivoById = async (req, res) => {
  try {
    const { id } = req.params;
    const produccion = await ProduccionReactivo.findById(id)
      .populate('reactivoId', 'nombre codigo tipo unidad')
      .populate('composicionReal.sustanciaId', 'nombre codigo tipo unidad')
      .populate('actividadId', 'nombre estado');
    
    if (!produccion) {
      return res.status(404).json({ error: "Producción de reactivo no encontrada" });
    }
    
    return res.status(200).json(produccion);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// U: Actualizar un registro de producción
const updateProduccionReactivo = async (req, res) => {
  try {
    const { id } = req.params;
    
    const produccionActualizada = await ProduccionReactivo.findByIdAndUpdate(id, req.body, { 
      new: true, 
      runValidators: true 
    });

    if (!produccionActualizada) {
      return res.status(404).json({ error: "Producción de reactivo no encontrada" });
    }

    return res.status(200).json(produccionActualizada);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// D: Eliminar un registro de producción
const deleteProduccionReactivo = async (req, res) => {
  try {
    const { id } = req.params;
    const produccionEliminada = await ProduccionReactivo.findByIdAndDelete(id);

    if (!produccionEliminada) {
      return res.status(404).json({ error: "Producción de reactivo no encontrada" });
    }

    return res.status(200).json({ message: "Registro de producción eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createProduccionReactivo,
  getProduccionesReactivos,
  getProduccionReactivoById,
  updateProduccionReactivo,
  deleteProduccionReactivo
};