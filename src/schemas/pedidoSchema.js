const Joi = require("joi");

const recursoSchemaJoi = Joi.object({
    tipo: Joi.string().valid("Equipo", "Material", "Reactivo").required(),
    nombre: Joi.string().min(2).max(100).required().messages({
        "string.empty": "El nombre del recurso es obligatorio",
        "string.min": "El nombre del recurso debe tener al menos 2 caracteres",
        "string.max": "El nombre del recurso no puede exceder los 100 caracteres",
    }),
    cantidad: Joi.number().min(1).required().messages({
        "number.base": "La cantidad debe ser un número",
        "number.min": "La cantidad debe ser al menos 1",
    }),
});

const pedidoSchemaJoi = Joi.object({
    materia: Joi.string().min(2).max(100).required().messages({
        "string.empty": "La materia es obligatoria",
        "string.min": "La materia debe tener al menos 2 caracteres",
        "string.max": "La materia no puede exceder los 100 caracteres",
    }),
    docente: Joi.string().required().messages({
        "string.empty": "El docente es obligatorio",
    }),
    fecha: Joi.string().required().messages({
        "string.empty": "La fecha es obligatoria",
    }),
    hora: Joi.string().required(). messages({
        "string.empty": "La hora es obligatoria",
    }),
    laboratorio: Joi.string().required() .messages({
        "string.empty": "El laboratorio es obligatorio",
    }),
    alumnos: Joi.number().min(1).required(). messages({
        "number.base": "La cantidad de alumnos debe ser un número",
        "number.min": "Debe haber al menos 1 alumno",
    }),
    estado: Joi.string().valid("Pendiente", "En Revisión", "Aceptado", "Rechazado").default("Pendiente"),
    recursos: Joi.array().items(recursoSchemaJoi).default([]).messages({
        "array.base": "Los recursos deben ser un arreglo",
    })  ,
    problemas: Joi.number().default(0).messages({
        "number.base": "La cantidad de problemas debe ser un número",
    }),
    detalleProblemas: Joi.array().items(Joi.string()).default([]).messages({
        "array.base": "El detalle de problemas debe ser un arreglo de cadenas",
    }),
});
