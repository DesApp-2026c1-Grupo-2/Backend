import Joi from "joi";

// Body para registrar un mantenimiento sobre un equipo (POST /equipos/:id/mantenimientos).
// El equipoId viaja por params y el responsableId se toma del JWT: no se aceptan por body.
const registrarMantenimientoSchema = Joi.object({
  tipo: Joi.string().valid("preventivo", "correctivo").required().messages({
    "any.only": "El tipo de mantenimiento debe ser 'preventivo' o 'correctivo'",
    "any.required": "El tipo de mantenimiento es obligatorio",
  }),
  descripcion: Joi.string().trim().max(500).allow("", null).optional().messages({
    "string.max": "La descripción no puede superar los 500 caracteres",
  }),
  fecha: Joi.date().iso().max("now").optional().messages({
    "date.max": "La fecha del mantenimiento no puede ser futura",
    "date.format": "La fecha debe estar en formato ISO",
  }),
});

// Body para finalizar el mantenimiento abierto de un equipo
// (PATCH /equipos/:id/mantenimientos/finalizar). La fecha de fin es opcional
// (por defecto "ahora"); no puede ser futura.
const finalizarMantenimientoSchema = Joi.object({
  fecha: Joi.date().iso().max("now").optional().messages({
    "date.max": "La fecha de fin no puede ser futura",
    "date.format": "La fecha debe estar en formato ISO",
  }),
});

// Query para listar el historial de un equipo (GET /equipos/:id/mantenimientos).
const historialMantenimientoQuerySchema = Joi.object({
  tipo: Joi.string().valid("preventivo", "correctivo").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

export {
  registrarMantenimientoSchema,
  finalizarMantenimientoSchema,
  historialMantenimientoQuerySchema,
};
