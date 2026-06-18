import Joi from "joi";

export const sugerenciaRecursoSchema = Joi.object({
  tipoActividad: Joi.string()
    .valid('quimica', 'biologia', 'teorica')
    .required(),

  itemId: Joi.string().hex().length(24).allow(null),

  equipoId: Joi.string().hex().length(24).allow(null),

  cantidadSugerida: Joi.number()
    .integer()
    .min(1)
    .required(),

  activo: Joi.boolean().optional()
})
.custom((value, helpers) => {
  if (!value.itemId && !value.equipoId) {
    return helpers.error('any.invalid', {
      message: 'Debe especificar itemId o equipoId'
    });
  }

  if (value.itemId && value.equipoId) {
    return helpers.error('any.invalid', {
      message: 'No puede tener itemId y equipoId simultáneamente'
    });
  }

  return value;
});