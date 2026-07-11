import { registrarDescarteService, revertirDescarteService } from "../services/descarte.service.js";
import Descarte from "../models/descarte.model.js";
import { registrarDescarteSchema } from "../schemas/descarteSchema.js";

const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 200;

// Normaliza page/limit de la query a enteros acotados (evita traer la colección
// completa, que es un log de descartes sin techo). Devuelve { page, limit, skip }.
const parsePaginacion = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limitPedido = parseInt(query.limit, 10) || LIMIT_DEFAULT;
  const limit = Math.min(Math.max(1, limitPedido), LIMIT_MAX);
  return { page, limit, skip: (page - 1) * limit };
};

export const registrarDescarte = async (req, res) => {
  try {
    const { id: pedidoId } = req.params;
    
    // Validar body vía Joi
    const { error, value } = registrarDescarteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const usuario = req.usuario; // Pasamos el usuario completo (id y rol)

    const descarte = await registrarDescarteService({ pedidoId, ...value }, usuario);
    
    return res.status(201).json({ message: "Descarte registrado correctamente", descarte });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// Historial de descartes paginado (mismo formato que GET /movimientos).
export const getDescartes = async (req, res) => {
  try {
    const { tipo, itemId, equipoId, pedidoId, reservaId, usuarioId, desde, hasta } = req.query;

    const filtros = {};
    if (tipo) filtros.tipo = tipo;
    if (itemId) filtros.itemId = itemId;
    if (equipoId) filtros.equipoId = equipoId;
    if (pedidoId) filtros.pedidoId = pedidoId;
    if (reservaId) filtros.reservaId = reservaId;
    if (usuarioId) filtros.usuarioId = usuarioId;
    if (desde || hasta) {
      filtros.createdAt = {};
      if (desde) filtros.createdAt.$gte = new Date(desde);
      if (hasta) filtros.createdAt.$lte = new Date(hasta);
    }

    const { page, limit, skip } = parsePaginacion(req.query);

    const [descartes, total] = await Promise.all([
      Descarte.find(filtros)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("itemId", "nombre codigo unidad")
        .populate("equipoId", "nombre codigo")
        .populate("usuarioId", "nombre apellido email")
        .populate("pedidoId", "materia fechaHora"),
      Descarte.countDocuments(filtros)
    ]);

    return res.status(200).json({ total, page, limit, descartes });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getHistorialPorItem = async (req, res) => {
  try {
    const { id } = req.params; // itemId o equipoId
    
    const descartes = await Descarte.find({ $or: [{ itemId: id }, { equipoId: id }] })
      .sort({ createdAt: -1 })
      .populate("usuarioId", "nombre apellido email")
      .populate("pedidoId", "materia fechaHora");
      
    return res.status(200).json(descartes);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const revertirDescarte = async (req, res) => {
  try {
    const { id } = req.params; // ID del Descarte
    const usuario = req.usuario; 

    await revertirDescarteService(id, usuario);
    
    return res.status(200).json({ message: "Descarte revertido y eliminado correctamente." });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

export const getHistorialPorPedido = async (req, res) => {
  try {
    const { id } = req.params; // pedidoId
    const descartes = await Descarte.find({ pedidoId: id })
      .sort({ createdAt: -1 })
      .populate("usuarioId", "nombre apellido email");
      
    return res.status(200).json(descartes);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};