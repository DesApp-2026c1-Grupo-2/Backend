import Joi from "joi";

export const registrarDescarteSchema = Joi.object({
  tipo: Joi.string().valid('material', 'reactivo', 'equipo').required().messages({
    "any.only": "El tipo debe ser 'material', 'reactivo' o 'equipo'"
  }),
  itemId: Joi.string().hex().length(24).when('tipo', {
    is: Joi.valid('material', 'reactivo'),
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }).messages({
    "any.required": "itemId es obligatorio para materiales y reactivos"
  }),
  equipoId: Joi.string().hex().length(24).when('tipo', {
    is: 'equipo',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }).messages({
    "any.required": "equipoId es obligatorio para equipos"
  }),
  cantidad: Joi.number().integer().min(1).required(),
  motivo: Joi.string().trim().min(5).max(500).required()
});

// Query para el historial de descartes paginado (GET /descartes).
// Valida que desde/hasta sean fechas ISO y que hasta no sea anterior a desde.
export const historialDescartesQuerySchema = Joi.object({
  tipo: Joi.string().valid('material', 'reactivo', 'equipo').optional(),
  itemId: Joi.string().hex().length(24).optional(),
  equipoId: Joi.string().hex().length(24).optional(),
  pedidoId: Joi.string().hex().length(24).optional(),
  reservaId: Joi.string().hex().length(24).optional(),
  usuarioId: Joi.string().hex().length(24).optional(),
  desde: Joi.date().iso().optional().messages({
    "date.format": "desde debe estar en formato ISO",
  }),
  // El piso (hasta >= desde) solo aplica si además se envió desde.
  hasta: Joi.date().iso().optional()
    .when('desde', { is: Joi.exist(), then: Joi.date().iso().min(Joi.ref('desde')) })
    .messages({
      "date.format": "hasta debe estar en formato ISO",
      "date.min": "hasta no puede ser anterior a desde",
    }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
});