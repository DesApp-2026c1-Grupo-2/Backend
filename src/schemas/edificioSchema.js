const Joi = require("joi");

const edificioSchemaJoi = Joi.object({
  nombre: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      "string.empty": "El nombre es obligatorio",
      "string.min": "El nombre debe tener al menos 2 caracteres",
      "string.max": "El nombre no puede superar los 100 caracteres",
    }),

  direccion: Joi.string()
    .trim()
    .max(200)
    .required()
    .messages({
      "string.empty": "La dirección es obligatoria",
      "string.max": "La dirección no puede superar los 200 caracteres",
    }),
});

module.exports = edificioSchemaJoi;