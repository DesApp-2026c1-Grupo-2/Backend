import Joi from "joi";

// Body para transferir/devolver un lote (POST /lotes/:id/transferir).
// `laboratorioDestinoId`: laboratorio destino, o `null` para DEVOLVER al depósito.
// Es obligatorio enviarlo explícitamente (null incluido) para evitar traslados ambiguos.
// `cantidad` (opcional): si se envía, es una transferencia PARCIAL (se mueve solo esa
// porción a un lote nuevo en el destino). Omitida => se mueve el lote completo. El tope
// `cantidad <= lote.cantidadDisponible` se valida en el controller (requiere el lote).
export const transferirLoteSchema = Joi.object({
  laboratorioDestinoId: Joi.string().hex().length(24).allow(null).required().messages({
    "any.required": "laboratorioDestinoId es obligatorio (usá null para devolver al depósito)",
    "string.hex": "laboratorioDestinoId debe ser un ObjectId válido",
    "string.length": "laboratorioDestinoId debe ser un ObjectId válido",
  }),
  cantidad: Joi.number().integer().positive().optional().messages({
    "number.base": "cantidad debe ser un número",
    "number.integer": "cantidad debe ser un entero",
    "number.positive": "cantidad debe ser mayor que 0",
  }),
  observacion: Joi.string().trim().max(500).optional(),
});
