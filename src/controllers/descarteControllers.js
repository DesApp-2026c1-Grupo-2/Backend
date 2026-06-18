import { registrarDescarteService, revertirDescarteService } from "../services/descarte.service.js";
import Descarte from "../models/descarte.model.js";
import { registrarDescarteSchema } from "../schemas/descarteSchema.js";

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