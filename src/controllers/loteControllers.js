const Lote = require("../models/lote.model");

// C: Crear un nuevo lote
const createLote = async (req, res) => {
  try {
    const nuevoLote = new Lote(req.body);
    const loteGuardado = await nuevoLote.save();
    
    return res.status(201).json(loteGuardado);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// R: Obtener todos los lotes (con filtros opcionales)
const getLotes = async (req, res) => {
  try {
    const { itemId, estado, ubicacion } = req.query;
    const filtros = {};

    if (itemId) filtros.itemId = itemId;
    if (estado) filtros.estado = estado;
    if (ubicacion) filtros.ubicacion = ubicacion;

    // Usamos populate para traer información relevante de las colecciones relacionadas
    const lotes = await Lote.find(filtros)
      .populate('itemId', 'nombre codigo tipo') // Traemos el nombre, código y tipo del Item
      .populate('actividadId', 'nombre estado');
      
    return res.status(200).json(lotes);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// R: Obtener un lote por su ID
const getLoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const lote = await Lote.findById(id)
      .populate('itemId', 'nombre codigo tipo')
      .populate('actividadId', 'nombre estado');
    
    if (!lote) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }
    
    return res.status(200).json(lote);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// U: Actualizar un lote
const updateLote = async (req, res) => {
  try {
    const { id } = req.params;
    
    const loteActualizado = await Lote.findByIdAndUpdate(id, req.body, { 
      new: true, 
      runValidators: true 
    });

    if (!loteActualizado) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }

    return res.status(200).json(loteActualizado);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// D: Eliminar un lote
const deleteLote = async (req, res) => {
  try {
    const { id } = req.params;
    const loteEliminado = await Lote.findByIdAndDelete(id);

    if (!loteEliminado) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }

    return res.status(200).json({ message: "Lote eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createLote,
  getLotes,
  getLoteById,
  updateLote,
  deleteLote
};