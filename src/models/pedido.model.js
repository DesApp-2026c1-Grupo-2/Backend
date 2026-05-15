const mongoose = require("mongoose");

const recursoSchema = new mongoose.Schema({
  recursoId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "tipoRecurso", // Permite popular dinámicamente entre Equipo e Item
  },
  tipoRecurso: {
    type: String,
    required: true,
    enum: ["Equipo", "Item"], // Colecciones válidas para poblar (dinámico)
  },
  cantidad: {
    type: Number,
    required: true,
    min: 1,
  },
  lotesDescontados: [{
    loteId: { type: mongoose.Schema.Types.ObjectId, ref: "Lote" },
    cantidadDescontada: { type: Number, required: true }
  }]
});

const pedidoSchema = new mongoose.Schema({
  materia: {
    type: String,
    required: true,
  },
  docente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  fechaHora: {
    type: Date,
    required: true,
  },
  laboratorio: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Laboratorio",
    required: true,
  },
  alumnos: {
    type: Number,
    required: true,
  },
  estado: {
    type: String,
    enum: ["Pendiente", "En Revisión", "Aceptado", "Rechazado", "Finalizado"],
    default: "Pendiente",
  },
  recursos: [recursoSchema],
  detalleProblemas: {
    type: [String],
    default: [],
  },
}, { 
  timestamps: true,
  strict: true,
  toJSON: {
    transform: (_, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
    },
  },
});

// Índices para optimizar queries frecuentes
pedidoSchema.index({ docente: 1, estado: 1 });
pedidoSchema.index({ laboratorio: 1 });
pedidoSchema.index({ fechaHora: -1 });

// Validación pre-save
pedidoSchema.pre("save", function() {
  if (!this.recursos || this.recursos.length === 0) {
    throw new Error("Un pedido debe tener al menos un recurso");
  }
});

module.exports = mongoose.model("pedidos", pedidoSchema);