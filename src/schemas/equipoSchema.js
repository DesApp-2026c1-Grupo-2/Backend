import Joi from "joi";

const createEquipoSchema = Joi.object({
  nombre: Joi.string().trim().min(2).max(100).required(),
  codigo: Joi.string().trim().required(),
  tipo: Joi.string().trim().required(),
  esFijo: Joi.boolean().required(),
  estado: Joi.string()
    .valid("disponible", "mantenimiento", "fuera de servicio")
    .default("disponible")
    .optional(),
  edificioId: Joi.string().hex().length(24).allow(null).default(null).messages({
    "string.length": "El ID del edificio debe tener exactamente 24 caracteres",
    "string.hex": "El ID del edificio debe ser un ObjectId válido",
  }),
  laboratorioId: Joi.string().hex().length(24).allow(null).default(null).messages({
    "string.length": "El ID del laboratorio debe tener exactamente 24 caracteres",
    "string.hex": "El ID del laboratorio debe ser un ObjectId válido",
  }),
  activo: Joi.boolean().default(true).optional(),
}).custom((value, helpers) => {
  if (value.esFijo === true && !value.laboratorioId) {
    return helpers.message("Un equipo fijo debe tener laboratorioId asignado");
  }

  if (value.esFijo === false && value.laboratorioId !== null) {
    return helpers.message("Un equipo móvil no debe tener laboratorioId");
  }

  return value; 
});

const updateEquipoSchema = Joi.object({
  nombre: Joi.string().trim().min(2).max(100).optional(),
  codigo: Joi.string().trim().optional(),
  tipo: Joi.string().trim().optional(),
  esFijo: Joi.boolean().optional(),
  estado: Joi.string()
    .valid("disponible", "mantenimiento", "fuera de servicio")
    .optional(),
  edificioId: Joi.string().hex().length(24).allow(null).optional().messages({
    "string.length": "El ID del edificio debe tener exactamente 24 caracteres",
    "string.hex": "El ID del edificio debe ser un ObjectId válido",
  }),
  laboratorioId: Joi.string().hex().length(24).allow(null).optional().messages({
    "string.length": "El ID del laboratorio debe tener exactamente 24 caracteres",
    "string.hex": "El ID del laboratorio debe ser un ObjectId válido",
  }),
  activo: Joi.boolean().optional(),
}).custom((value, helpers) => {
  // 1. Si ambos campos viajan en la petición, validamos que la combinación tenga sentido
  if (value.esFijo !== undefined && value.laboratorioId !== undefined) {
    if (value.esFijo === true && value.laboratorioId === null) {
      return helpers.message("Un equipo fijo debe tener laboratorioId asignado");
    }
    if (value.esFijo === false && value.laboratorioId !== null) {
      return helpers.message("Un equipo móvil no debe tener laboratorioId");
    }
  } 
  // 2. Normalización automática si se convierte en móvil pero no se mandó laboratorioId explícito en null
  else if (value.esFijo === false && value.laboratorioId === undefined) {
    value.laboratorioId = null;
  }
  return value;
});

const equipoIdParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required().messages({
    "string.length": "El ID del equipo debe tener exactamente 24 caracteres",
    "string.hex": "El ID del equipo debe ser un ObjectId válido",
  })
});

const equipoQuerySchema = Joi.object({
  estado: Joi.string().valid("disponible", "mantenimiento", "fuera de servicio").optional(),
  edificioId: Joi.string().hex().length(24).allow("null").optional(),
  laboratorioId: Joi.string().hex().length(24).allow("null").optional(),
  // Búsqueda + paginación para la pantalla de Stock. Sin estos campos el
  // middleware validate (stripUnknown) los descartaría antes del controller.
  q: Joi.string().trim().allow("").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const estadisticasUsoQuerySchema = Joi.object({
  periodo: Joi.string().valid("dia", "semana", "mes").default("semana"),
  fecha: Joi.date().iso().default(() => new Date()),
  laboratorioId: Joi.string().hex().length(24).optional().messages({
    "string.length": "El ID del laboratorio debe tener exactamente 24 caracteres",
    "string.hex": "El ID del laboratorio debe ser un ObjectId válido",
  }),
  equipoId: Joi.string().hex().length(24).optional().messages({
    "string.length": "El ID del equipo debe tener exactamente 24 caracteres",
    "string.hex": "El ID del equipo debe ser un ObjectId válido",
  }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

export {
  createEquipoSchema,
  updateEquipoSchema,
  equipoIdParamSchema,
  equipoQuerySchema,
  estadisticasUsoQuerySchema,
};