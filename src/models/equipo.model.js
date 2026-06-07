import mongoose from "mongoose";

const equipoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    codigo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    tipo: {
      type: String,
      required: true,
      trim: true,
    },
    esFijo: {
      type: Boolean,
      required: true,
    },
    estado: {
      type: String,
      enum: [
        "disponible",
        "mantenimiento",
        "fuera de servicio",
      ],
      default: "disponible",
    },
    edificioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Edificio",
      default: null,
      index: true,
    },
    laboratorioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Laboratorio",
      index: true,
      default: null,
    },
    activo: {
      type: Boolean,
      default: true,
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

equipoSchema.pre("validate", function () {
  // Validación de respaldo (Última línea de defensa)
  if (this.esFijo === true && !this.laboratorioId) {
    this.invalidate('laboratorioId', 'Un equipo fijo debe tener laboratorioId asignado');
  }
  if (this.esFijo === false && this.laboratorioId != null) {
    this.invalidate('laboratorioId', 'Un equipo móvil no debe tener laboratorioId');
  }
});

export default mongoose.models.Equipo || mongoose.model('Equipo', equipoSchema);