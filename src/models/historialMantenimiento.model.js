import mongoose from "mongoose";

/*
 * Historial de mantenimiento de equipos.
 *
 * Modelado como colección "temporal" append-only: cada registro es un evento
 * puntual e inmutable (fecha + tipo + equipo). No se actualiza ni se borra en el
 * flujo normal; solo se inserta y se consulta. El índice compuesto
 * { equipoId, fecha } cubre la consulta principal (historial de un equipo
 * ordenado por fecha descendente).
 *
 */
const historialMantenimientoSchema = new mongoose.Schema(
  {
    // timeField: momento en que se inició el mantenimiento.
    fecha: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Momento en que se cerró el mantenimiento (equipo vuelve a disponible).
    // null mientras el mantenimiento está abierto.
    fin: {
      type: Date,
      default: null,
    },
    equipoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipo",
      required: true,
    },
    tipo: {
      type: String,
      enum: ["preventivo", "correctivo"],
      required: true,
    },
    // Usuario que registró el mantenimiento (tomado del JWT).
    responsableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
    },
    descripcion: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
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

historialMantenimientoSchema.pre("validate", function () {
  if (this.fin != null && this.fin < this.fecha) {
    this.invalidate(
      "fin",
      "La fecha de fin no puede ser anterior a la fecha de inicio",
    );
  }
});

// Consulta principal: historial de un equipo, más reciente primero.
historialMantenimientoSchema.index({ equipoId: 1, fecha: -1 });

export default mongoose.models.HistorialMantenimiento ||
  mongoose.model("HistorialMantenimiento", historialMantenimientoSchema);
