const mongoose = require("mongoose");

const equipoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    tipo: {
      type: String,
      required: true,
    },
    esFijo: {
      type: Boolean,
      required: true,
    },
    estado: {
      type: String,
      //Reservado deberia estar en una entidad a parte, por ahora lo dejo aca para hacer pruebas
      enum: [
        "disponible",
        "reservado",
        "en mantenimiento",
        "fuera de servicio",
      ],
      default: "disponible",
    },
    edificioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Edificio",
      required: true,
      index: true,
    },
    laboratorioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Laboratorio",
      index: true,
    },
  },
  {
    timestamps: true,
    strict: true,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  },
);

equipoSchema.pre("save", function () {
  if (this.esFijo && !this.laboratorioId) {
    throw new Error("Un equipo fijo debe tener laboratorioId asignado");
  }

  if (!this.esFijo && this.laboratorioId) {
    throw new Error("Un equipo móvil no debe tener laboratorioId");
  }
});

module.exports = mongoose.model('Equipo', equipoSchema);