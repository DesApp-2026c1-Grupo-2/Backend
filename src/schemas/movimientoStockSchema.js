import Joi from "joi";

// Query para el historial de movimientos de stock paginado (GET /movimientos).
// Valida que desde/hasta sean fechas ISO y que hasta no sea anterior a desde.
export const movimientosQuerySchema = Joi.object({
  itemId: Joi.string().hex().length(24).optional(),
  tipoMovimiento: Joi.string().valid(
    'APROBACION_RESERVA',
    'DEVOLUCION',
    'DESCARTE',
    'COMPRA',
    'AJUSTE_MANUAL',
    'TRANSFERENCIA',
    'MANTENIMIENTO',
    'BAJA'
  ).optional(),
  reservaId: Joi.string().hex().length(24).optional(),
  laboratorioId: Joi.string().hex().length(24).optional(),
  desde: Joi.date().iso().optional().messages({
    "date.format": "desde debe estar en formato ISO",
  }),
  // El piso (hasta >= desde) solo aplica si además se envió desde.
  hasta: Joi.date().iso().optional()
    .when('desde', { is: Joi.exist(), then: Joi.date().iso().min(Joi.ref('desde')) })
    .messages({
      "date.format": "hasta debe estar en formato ISO",
      "date.min": "hasta no puede ser anterior a desde",
    }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
});
