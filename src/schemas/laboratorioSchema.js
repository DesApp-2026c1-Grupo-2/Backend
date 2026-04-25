const Joi = require("joi");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const laboratorioSchemaJoi = Joi.object({
    nombre: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({
        "string.empty": "El nombre es obligatorio",
        "string.min": "El nombre debe tener al menos 2 caracteres",
        }),

    edificioId: Joi.string()
        .pattern(objectIdRegex)
        .required()
        .messages({
        "string.pattern.base": "El edificioId debe ser un ObjectId válido",
        "any.required": "El edificioId es obligatorio",
        }),

    capacidad: Joi.number()
        .integer()
        .min(1)
        .required()
        .messages({
        "number.base": "La capacidad debe ser un número",
        "number.min": "La capacidad debe ser al menos 1",
        }),

    tipo: Joi.string()
        .valid("biologia", "quimica", "mixto")
        .required()
        .messages({
        "any.only": "El tipo debe ser biologia, quimica o mixto",
        }),

    estado: Joi.string()
        .valid("disponible", "reservado", "en mantenimiento", "fuera de servicio")
        .optional(),
});

module.exports = laboratorioSchemaJoi;