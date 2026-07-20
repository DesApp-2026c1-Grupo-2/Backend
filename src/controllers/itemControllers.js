import mongoose from "mongoose";
import Item from "../models/item.model.js";
import Lote from "../models/lote.model.js";
import Equipo from "../models/equipo.model.js";
import { desgloseStock } from "../services/disponibilidad.js";
import { parsePaginacion } from "../utils/paginacion.js";

// Suma de cantidadDisponible (lotes disponibles y activos) agrupada por item,
// en UNA sola agregación para el conjunto de items de la página. Evita el N+1
// de llamar a Lote.calcularStockDisponible por cada item del listado.
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

// R: Listado paginado de items con stockDisponible por item.
// Además devuelve cantidadDisponible para compatibilidad con el formulario de pedidos.
const getItems = async (req, res) => {
  try {
    const { tipo, esConsumible, q, sort, order } = req.query;
    const filtros = { activo: { $ne: false } };

    if (tipo) filtros.tipo = tipo;
    if (esConsumible !== undefined) filtros.esConsumible = esConsumible;
    if (q) {
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
      cantidadDisponible: stockPorItem.get(String(item._id)) ?? 0,
    }));

    return res.status(200).json({ total, page, limit, items: itemsConStock });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// R: Conteos agregados para las tarjetas de la pantalla de Stock.
const getEstadisticasItems = async (_req, res) => {
  try {
    const [porTipo, equipos, descartes] = await Promise.all([
      Item.aggregate([
        { $match: { activo: { $ne: false } } },
        { $group: { _id: "$tipo", count: { $sum: 1 } } },
      ]),
      Equipo.countDocuments({ activo: { $ne: false } }),
      Lote.countDocuments({ estado: "descartado", activo: { $ne: false } }),
    ]);
    const conteo = Object.fromEntries(porTipo.map((f) => [f._id, f.count]));
    return res.status(200).json({
      equipos,
      materiales: conteo.material || 0,
      reactivos: conteo.reactivo || 0,
      sustancias: conteo.sustancia || 0,
      descartes,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// R: Obtener un item por su ID (incluye stock dinámico)
const getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findOne({ _id: id, activo: { $ne: false } });

    if (!item) {
      return res.status(404).json({ error: "Ítem no encontrado" });
    }

    const stockDisponible = await Lote.calcularStockDisponible(id);

    return res.status(200).json({
      ...item.toObject(),
      stockDisponible,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// R: Vista de gestión de stock por rango horario
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
        return res.status(400).json({ error: "Parámetros 'desde'/'hasta' inválidos (se espera ISO)" });
      }
      if (inicio >= fin) {
        return res.status(400).json({ error: "'desde' debe ser anterior a 'hasta'" });
      }
    } else {
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

// D: Eliminar un item de forma lógica
const deleteItemLogico = async (req, res) => {
  try {
    const { id } = req.params;

    const lotesAsociados = await Lote.exists({
      itemId: id,
      activo: true,
    });
    if (lotesAsociados) {
      return res.status(409).json({
        error: "No se puede eliminar el ítem porque tiene lotes registrados en el inventario. Vacíe el stock primero o mueva los lotes a estado 'descartado'.",
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
  deleteItemLogico,
};
