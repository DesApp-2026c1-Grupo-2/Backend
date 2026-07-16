import Joi from "joi";

const recursoSchemaJoi = Joi.object({
    recursoId: Joi.string().hex().length(24).required().messages({
        "string.empty": "El ID del recurso es obligatorio",
        "string.length": "El ID del recurso debe tener exactamente 24 caracteres",
        "string.hex": "El ID del recurso debe ser un ObjectId válido",
    }),
    tipoRecurso: Joi.string().valid("Equipo", "Item").required().messages({
        "any.only": "El tipo de recurso debe ser estrictamente 'Equipo' o 'Item'",
        "any.required": "El tipo de recurso es obligatorio",
    }),
    modeloRef: Joi.string().valid("Equipo", "Item").optional(),
    tipo: Joi.string().valid("Equipo", "Material", "Reactivo", "Sustancia").optional(),
    cantidad: Joi.number().min(1).required().messages({
        "number.base": "La cantidad debe ser un número",
        "number.min": "La cantidad debe ser al menos 1",
    }),
});

const tareaSchemaJoi = Joi.object({
    descripcion: Joi.string().required(),
    estado: Joi.string().valid("Pendiente", "En Proceso", "Completada").default("Pendiente"),
    tipo: Joi.string().valid("Logistica", "Preparacion", "Compra", "General").default("General")
});

const pedidoSchemaJoi = Joi.object({
    materia: Joi.string().trim().min(2).max(100).required().messages({
        "string.empty": "La materia es obligatoria",
        "string.min": "La materia debe tener al menos 2 caracteres",
        "string.max": "La materia no puede exceder los 100 caracteres",
    }),
    docente: Joi.string().hex().length(24).required().messages({
        "string.length": "El ID del docente debe ser válido (24 caracteres)",
        "string.empty": "El docente es obligatorio",
    }),
    fechaHora: Joi.date().iso().optional(),
    fecha: Joi.string().optional().messages({
        "string.empty": "La fecha es obligatoria",
    }),
    hora: Joi.string().optional().messages({
        "string.empty": "La hora es obligatoria",
    }),
    duracionClase: Joi.number().integer().min(1).required().messages({
        "number.base": "La duración de la clase debe ser un número",
        "number.integer": "La duración de la clase debe ser un número entero",
        "number.min": "La duración de la clase debe ser de al menos 1 minuto",
        "any.required": "La duración de la clase es obligatoria",
    }),
    fechaInicioReal: Joi.any().forbidden().messages({
        "any.unknown": "No se permite enviar fechaInicioReal, este valor se calcula automáticamente",
    }),
    fechaFinReal: Joi.any().forbidden().messages({
        "any.unknown": "No se permite enviar fechaFinReal, este valor se calcula automáticamente",
    }),
    laboratorio: Joi.alternatives()
        .try(
            Joi.string().hex().length(24),
            Joi.valid(null, "")
        )
        .optional()
        .messages({
            "string.length": "El ID del laboratorio debe ser válido (24 caracteres)",
        }),
    alumnos: Joi.number().min(1).required().messages({
        "number.base": "La cantidad de alumnos debe ser un número",
        "number.min": "Debe haber al menos 1 alumno",
    }),
    estado: Joi.string().valid("Pendiente", "Aceptado", "Rechazado", "Finalizado", "Cancelado", "Expirado").default("Pendiente"),
    recursos: Joi.array().items(recursoSchemaJoi).min(0).default([]).messages({
        "array.base": "Los recursos deben ser un arreglo",
    }),
    detalleProblemas: Joi.array().items(Joi.string()).default([]).messages({
        "array.base": "El detalle de problemas debe ser un arreglo de cadenas",
    }),
    checklist: Joi.array().items(tareaSchemaJoi).default([]),
    activo: Joi.boolean().default(true).optional(),
}).xor("fechaHora", "fecha").with("fecha", "hora").messages({
    "object.missing": "Debe proporcionar 'fechaHora' o la combinación de 'fecha' y 'hora'",
    "object.xor": "No puede proporcionar 'fechaHora' and 'fecha' al mismo tiempo",
    "object.with": "Si proporciona 'fecha', también debe proporcionar 'hora'"
});

// Body de PATCH /pedidos/:id/finalizar.
//
// `consumos` figura como opcional acá porque su obligatoriedad NO es una cuestión
// de forma: depende del estado físico del stock (si ya salió y sigue sin liquidar),
// que Joi no puede ver. Esa exigencia la resuelve el gate del servicio
// (validarConsumosRequeridos), que devuelve 400 listando los consumibles faltantes.
// El front puede anticipar qué reportar con GET /reservas/pedido/:pedidoId.
//
// `consumos` reporta el consumo real de consumibles para devolver el sobrante
// (misma forma que finalizarReservaSchema). `descartes`/`desperfectos` alimentan
// el registro de descartes y el envío de equipos a mantenimiento.
const consumoFinalizacionJoi = Joi.object({
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
});

const descarteFinalizacionJoi = Joi.object({
    tipo: Joi.string().optional(),
    itemId: Joi.string().hex().length(24).optional(),
    equipoId: Joi.string().hex().length(24).optional(),
    cantidad: Joi.number().min(1).optional(),
    motivo: Joi.string().optional(),
});

const desperfectoFinalizacionJoi = Joi.alternatives().try(
    Joi.string().hex().length(24),
    Joi.object({
        equipoId: Joi.string().hex().length(24).required(),
        motivo: Joi.string().optional(),
    })
);

export const finalizarPedidoSchema = Joi.object({
    descartes: Joi.array().items(descarteFinalizacionJoi).optional(),
    desperfectos: Joi.array().items(desperfectoFinalizacionJoi).optional(),
    consumos: Joi.array().items(consumoFinalizacionJoi).optional(),
});

export default pedidoSchemaJoi;