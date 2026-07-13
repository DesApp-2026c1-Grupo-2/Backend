import Joi from "joi";

// Body para finalizar una reserva a mano reportando el consumo real de cada
// consumible (PATCH /reservas/:id/finalizar). `consumos` es opcional: los items
// omitidos se dan por consumidos en su totalidad. La cota superior (consumido <=
// reservado) se aplica en el controller (depende de lo que salió de cada lote).
export const finalizarReservaSchema = Joi.object({
  consumos: Joi.array()
    .items(
      Joi.object({
        itemId: Joi.string().hex().length(24).required().messages({
          "any.required": "itemId es obligatorio en cada consumo",
          "string.hex": "itemId debe ser un ObjectId válido",
          "string.length": "itemId debe ser un ObjectId válido",
        }),
        cantidadConsumida: Joi.number().min(0).required().messages({
          "any.required": "cantidadConsumida es obligatoria",
          "number.base": "cantidadConsumida debe ser un número",
          "number.min": "cantidadConsumida no puede ser negativa",
        }),
      })
    )
    .optional(),
});
