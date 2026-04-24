const Joi = require("joi");

const equipoSchemaJoi = Joi.object({
  nombre: Joi.string().min(2).max(100).required(),
  tipo: Joi.string().required(),
  esFijo: Joi.boolean().required(),
  estado: Joi.string()
    .valid("disponible", "reservado", "mantenimiento", "fuera_de_servicio")
    .optional(),
  edificioId: Joi.string().required(),
  laboratorioId: Joi.string().allow(null, ""), 
}).custom((value, helpers) => {
  

  if (value.esFijo && !value.laboratorioId) {
    return helpers.message("Un equipo fijo debe estar asignado a un laboratorio (laboratorioId).");
  }

  if (!value.esFijo && value.laboratorioId) {
    return helpers.message("Un equipo móvil (no fijo) no debe tener un laboratorioId asignado directamente.");
  }

  return value; 
});

module.exports = equipoSchemaJoi;