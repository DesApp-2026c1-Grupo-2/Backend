const Joi = require("joi");

const recursoSchemaJoi = Joi.object({
    recursoId: Joi.string().hex().length(24).required().messages({
        "string.empty": "El ID del recurso es obligatorio",
        "string.length": "El ID del recurso debe tener exactamente 24 caracteres",
        "string.hex": "El ID del recurso debe ser un ObjectId válido",
    }),
    modeloRef: Joi.string().valid("Equipo", "Item").required().messages({
        "any.only": "La referencia de modelo debe ser estrictamente 'Equipo' o 'Item'",
    }),
    tipo: Joi.string().valid("Equipo", "Material", "Reactivo", "Sustancia").required(),
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
    docente: Joi.string().hex().length(24).required().messages({
        "string.length": "El ID del docente debe ser válido (24 caracteres)",
        "string.empty": "El docente es obligatorio",
    }),
    fecha: Joi.string().required().messages({
        "string.empty": "La fecha es obligatoria",
    }),
    hora: Joi.string().required(). messages({
        "string.empty": "La hora es obligatoria",
    }),
    laboratorio: Joi.string().hex().length(24).required().messages({
        "string.length": "El ID del laboratorio debe ser válido (24 caracteres)",
        "string.empty": "El laboratorio es obligatorio",
    }),
    alumnos: Joi.number().min(1).required(). messages({
        "number.base": "La cantidad de alumnos debe ser un número",
        "number.min": "Debe haber al menos 1 alumno",
    }),
    estado: Joi.string().valid("Pendiente", "En Revisión", "Aceptado", "Rechazado", "Finalizado").default("Pendiente"),
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
