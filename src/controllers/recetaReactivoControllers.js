const RecetaReactivo = require("../models/recetaReactivo.model");

// C: Crear una nueva receta de reactivo
const createRecetaReactivo = async (req, res) => {
  try {
    const nuevaReceta = new RecetaReactivo(req.body);
    const recetaGuardada = await nuevaReceta.save();
    
    return res.status(201).json(recetaGuardada);
  } catch (error) {
    // Error de clave duplicada (reactivoId unique)
    if (error.code === 11000) {
      return res.status(400).json({ error: "Ya existe una receta registrada para este reactivo." });
    }
    return res.status(400).json({ error: error.message });
  }
};

// R: Obtener todas las recetas de reactivos
const getRecetasReactivos = async (req, res) => {
  try {
    const { reactivoId } = req.query;
    const filtros = { activo: { $ne: false } };

    if (reactivoId) filtros.reactivoId = reactivoId;

    const recetas = await RecetaReactivo.find(filtros)
      .populate('reactivoId', 'nombre codigo tipo unidad')
      .populate('composicion.sustanciaId', 'nombre codigo tipo unidad');
      
    return res.status(200).json(recetas);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// R: Obtener una receta por su ID
const getRecetaReactivoById = async (req, res) => {
  try {
    const { id } = req.params;
    const receta = await RecetaReactivo.findOne({ _id: id, activo: { $ne: false } })
      .populate('reactivoId', 'nombre codigo tipo unidad')
      .populate('composicion.sustanciaId', 'nombre codigo tipo unidad');
    
    if (!receta) {
      return res.status(404).json({ error: "Receta de reactivo no encontrada" });
    }
    
    return res.status(200).json(receta);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// U: Actualizar una receta de reactivo
const updateRecetaReactivo = async (req, res) => {
  try {
    const { id } = req.params;
    
    const recetaActualizada = await RecetaReactivo.findOneAndUpdate(
      { _id: id, activo: { $ne: false } },
      req.body,
      { new: true, runValidators: true }
    );

    if (!recetaActualizada) {
      return res.status(404).json({ error: "Receta de reactivo no encontrada" });
    }

    return res.status(200).json(recetaActualizada);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "Ya existe una receta registrada para este reactivo." });
    }
    return res.status(400).json({ error: error.message });
  }
};

// D: Eliminar una receta de reactivo
const deleteRecetaReactivo = async (req, res) => {
  try {
    const { id } = req.params;
    const recetaEliminada = await RecetaReactivo.findOneAndUpdate(
      { _id: id, activo: { $ne: false } },
      { activo: false },
      { new: true }
    );

    if (!recetaEliminada) {
      return res.status(404).json({ error: "Receta de reactivo no encontrada" });
    }

    return res.status(200).json({ message: "Receta de reactivo marcada como eliminada (borrado lógico)", receta: recetaEliminada });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createRecetaReactivo,
  getRecetasReactivos,
  getRecetaReactivoById,
  updateRecetaReactivo,
  deleteRecetaReactivo
};