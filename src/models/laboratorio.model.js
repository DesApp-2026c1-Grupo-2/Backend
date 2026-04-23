const mongoose = require("mongoose");

const laboratorioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },

    codigo: { type: String, required: true, unique: true },

    edificio: {
      nombre: { type: String, required: true },
      ubicacion: { type: String },
    },

    capacidad: { type: Number, required: true, min: 1 },

    tipo: {
      type: String,
      enum: ["biologia", "quimica", "mixto"],
      required: true,
    },

    estado: {
      type: String,
      enum: ["activo", "mantenimiento", "fuera_de_servicio"],
      default: "activo",
    },

    equipos: [
      {
        equipoId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Equipo",
          required: true,
        },
        nombre: String,
        cantidad: { type: Number, required: true, min: 0 },
        fijo: { type: Boolean, default: false },
      },
    ],

    descripcion: { type: String },
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

const Laboratorio = mongoose.model("Laboratorio", laboratorioSchema);

module.exports = Laboratorio;