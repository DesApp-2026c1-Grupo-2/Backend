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