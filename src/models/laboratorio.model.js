const mongoose = require("mongoose");

const laboratorioSchema = new mongoose.Schema(
    {
        nombre: {
        type: String,
        required: true,
        trim: true,
        },

        edificioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Edificio",
        required: true,
        },

        capacidad: {
        type: Number,
        required: true,
        min: 1,
        },

        tipo: {
        type: String,
        enum: ["biologia", "quimica", "mixto"],
        required: true,
        },

        estado: {
        type: String,
        enum: ["disponible", "reservado", "en mantenimiento", "fuera de servicio"],
        default: "disponible",
        },
    },
    {
        timestamps: true,
        strict: true,

        toJSON: {
            virtuals: true,
            transform: (_, ret) => {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
            },
        },
    }
);

/**
 * Virtual para saber que equipos fijos tiene el laboratorio
 */
laboratorioSchema.virtual("equiposFijos", {
  ref: "Equipo",
  localField: "_id",
  foreignField: "laboratorioId",
  match: { esFijo: true },
});

const Laboratorio = mongoose.model("Laboratorio", laboratorioSchema);

module.exports = Laboratorio;