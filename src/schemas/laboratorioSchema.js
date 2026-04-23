const Joi = require("joi");

const laboratorioSchema = Joi.object({
  nombre: Joi.string().min(3).max(100).required().messages({
    "any.required": "El nombre es obligatorio",
  }),

  codigo: Joi.string().min(2).max(20).required(),

  edificio: Joi.object({
    nombre: Joi.string().required(),
    ubicacion: Joi.string().allow("", null),
  }).required(),

  capacidad: Joi.number().min(1).required(),

  tipo: Joi.string().valid("biologia", "quimica", "mixto").required(),

  estado: Joi.string().valid("activo", "mantenimiento", "fuera_de_servicio"),

  equipos: Joi.array().items(
    Joi.object({
      equipoId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required(),
      nombre: Joi.string().allow("", null),
      cantidad: Joi.number().min(0).required(),
      fijo: Joi.boolean(),
    })
  ),

  descripcion: Joi.string().allow("", null),
});

module.exports = { laboratorioSchema };