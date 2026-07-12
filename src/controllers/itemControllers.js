import mongoose from "mongoose";
import Item from "../models/item.model.js";
import Lote from "../models/lote.model.js"; // Necesario para validar antes de borrar
import Equipo from "../models/equipo.model.js";
import { desgloseStock } from "../services/disponibilidad.js";
import { parsePaginacion } from "../utils/paginacion.js";

// Suma de cantidadDisponible (lotes disponibles y activos) agrupada por item,
// en UNA sola agregación para el conjunto de items de la página. Evita el N+1
// de llamar a Lote.calcularStockDisponible por cada item del listado.
// Devuelve un Map<string itemId, number stock>.
const stockDisponiblePorItem = async (itemIds) => {
  if (itemIds.length === 0) return new Map();
  const oids = itemIds.map((id) => new mongoose.Types.ObjectId(id));
  const filas = await Lote.aggregate([
    { $match: { itemId: { $in: oids }, estado: "disponible", activo: { $ne: false } } },
    { $group: { _id: "$itemId", stock: { $sum: "$cantidadDisponible" } } },
  ]);
  return new Map(filas.map((f) => [String(f._id), f.stock]));
};


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

// R: Listado paginado de items con stockDisponible por item (pantalla de Stock).
// Query validada por itemQuerySchema: Joi ya aplicó defaults y coerción de tipos.
const getItems = async (req, res) => {
  try {
    const { tipo, esConsumible, q, sort, order } = req.query;
    const filtros = { activo: { $ne: false } };

    if (tipo) filtros.tipo = tipo;
    if (esConsumible !== undefined) filtros.esConsumible = esConsumible;
    if (q) {
      // Búsqueda parcial case-insensitive sobre nombre o código. Se escapan los
      // metacaracteres para tratar la entrada como texto literal.
      const termino = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filtros.$or = [{ nombre: termino }, { codigo: termino }];
    }

    const { page, limit, skip } = parsePaginacion(req.query, { def: 20, max: 100 });
    const orden = { [sort || "nombre"]: order === "desc" ? -1 : 1 };

    const [items, total] = await Promise.all([
      Item.find(filtros).sort(orden).skip(skip).limit(limit),
      Item.countDocuments(filtros),
    ]);

    const stockPorItem = await stockDisponiblePorItem(items.map((i) => i.id));
    const itemsConStock = items.map((item) => ({
      ...item.toObject(),
      stockDisponible: stockPorItem.get(String(item._id)) ?? 0,
    }));

    return res.status(200).json({ total, page, limit, items: itemsConStock });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// R: Estadísticas de inventario para el dashboard.
// Conteo de items por tipo (sustancia/reactivo/material), equipos activos
// (colección Equipo) y descartes (lotes en estado 'descartado').
const getEstadisticasItems = async (req, res) => {
  try {
    const porTipo = await Item.aggregate([
      { $match: { activo: { $ne: false } } },
      { $group: { _id: "$tipo", count: { $sum: 1 } } },
    ]);
    const conteos = Object.fromEntries(porTipo.map((t) => [t._id, t.count]));

    const [equipos, descartes] = await Promise.all([
      Equipo.countDocuments({ activo: { $ne: false } }),
      Lote.countDocuments({ estado: "descartado", activo: { $ne: false } }),
    ]);

    return res.status(200).json({
      equipos,
      materiales: conteos.material ?? 0,
      reactivos: conteos.reactivo ?? 0,
      sustancias: conteos.sustancia ?? 0,
      descartes,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// R: Obtener un item por su ID (Ahora incluye el stock dinámico)
 const getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findOne({ _id: id, activo: { $ne: false } });
    
    if (!item) {
      return res.status(404).json({ error: "Ítem no encontrado" });
    }
    
    // Calculamos el stock real sumando los lotes disponibles
    const stockDisponible = await Lote.calcularStockDisponible(id);
    
    return res.status(200).json({
      ...item.toObject(),
      stockDisponible
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// R: Vista de gestión de stock por rango horario (§14)
// GET /items/:id/stock?desde=<ISO>&hasta=<ISO>  (sin rango → día actual)
const getStockItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findOne({ _id: id, activo: { $ne: false } });
    if (!item) {
      return res.status(404).json({ error: "Ítem no encontrado" });
    }

    const { desde, hasta } = req.query;
    let inicio, fin;

    if (desde || hasta) {
      inicio = new Date(desde);
      fin = new Date(hasta);
      if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
        return res
          .status(400)
          .json({ error: "Parámetros 'desde'/'hasta' inválidos (se espera ISO)" });
      }
      if (inicio >= fin) {
        return res
          .status(400)
          .json({ error: "'desde' debe ser anterior a 'hasta'" });
      }
    } else {
      // Sin rango → día actual completo.
      inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      fin = new Date();
      fin.setHours(23, 59, 59, 999);
    }

    const desglose = await desgloseStock(id, inicio, fin);
    return res.status(200).json({
      itemId: id,
      desde: inicio,
      hasta: fin,
      ...desglose,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// U: Actualizar un item
const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    const itemActualizado = await Item.findOneAndUpdate(
      { _id: id, activo: { $ne: false } },
      req.body, 
      { new: true, runValidators: true }
    );

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

// D: Eliminar un item de forma lógica (Con protección de integridad)
const deleteItemLogico = async (req, res) => {
  try {
    const { id } = req.params;

    // PROTECCIÓN: Verificar si existen lotes asociados antes de borrar
    const lotesAsociados = await Lote.exists({ itemId: id });
    if (lotesAsociados) {
      return res.status(409).json({ 
        error: "No se puede eliminar el ítem porque tiene lotes registrados en el inventario. Vacíe el stock primero o mueva los lotes a estado 'descartado'." 
      });
    }

    const itemEliminado = await Item.findOneAndUpdate(
      { _id: id, activo: { $ne: false } },
      { activo: false },
      { new: true }
    );

    if (!itemEliminado) {
      return res.status(404).json({ error: "Ítem no encontrado" });
    }

    return res.status(200).json({ message: "Ítem marcado como eliminado (borrado lógico)", item: itemEliminado });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export {
  createItem,
  getItems,
  getEstadisticasItems,
  getItemById,
  getStockItem,
  updateItem,
  deleteItemLogico
};