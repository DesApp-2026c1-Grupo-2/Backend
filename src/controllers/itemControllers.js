const Item = require("../models/item.model")
const Lote = require('../models/lote.model') // Necesario para validar antes de borrar


// C: Crear un nuevo item
const createItem = async (req, res) => {
  try {
    const nuevoItem = new Item(req.body);
    const itemGuardado = await nuevoItem.save();
    return res.status(201).json(itemGuardado);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "El código del ítem ya existe" });
    }
    return res.status(400).json({ error: error.message });
  }
};

// R: Obtener todos los items
const getItems = async (req, res) => {
  try {
    const { tipo, esConsumible } = req.query;
    const filtros = {};

    if (tipo) filtros.tipo = tipo;
    if (esConsumible !== undefined) filtros.esConsumible = esConsumible === 'true';

    const items = await Item.find(filtros);
    return res.status(200).json(items);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// R: Obtener un item por su ID (Ahora incluye el stock dinámico)
 const getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);
    
    if (!item) {
      return res.status(404).json({ error: "Ítem no encontrado" });
    }
    
    // Calculamos el stock real sumando los lotes disponibles
    const stockDisponible = await inventarioService.calcularStockDisponible(id);
    
    return res.status(200).json({
      ...item.toObject(),
      stockDisponible
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// U: Actualizar un item
const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    const itemActualizado = await Item.findByIdAndUpdate(id, req.body, { 
      new: true, 
      runValidators: true 
    });

    if (!itemActualizado) {
      return res.status(404).json({ error: "Ítem no encontrado" });
    }

    return res.status(200).json(itemActualizado);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "El código del ítem ya existe" });
    }
    return res.status(400).json({ error: error.message });
  }
};

// D: Eliminar un item (Con protección de integridad)
const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    // PROTECCIÓN: Verificar si existen lotes asociados antes de borrar
    const lotesAsociados = await Lote.exists({ itemId: id });
    if (lotesAsociados) {
      return res.status(409).json({ 
        error: "No se puede eliminar el ítem porque tiene lotes registrados en el inventario. Vacíe el stock primero o mueva los lotes a estado 'descartado'." 
      });
    }

    const itemEliminado = await Item.findByIdAndDelete(id);

    if (!itemEliminado) {
      return res.status(404).json({ error: "Ítem no encontrado" });
    }

    return res.status(200).json({ message: "Ítem eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem
};