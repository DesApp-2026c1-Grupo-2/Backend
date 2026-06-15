import mongoose from "mongoose";

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

const comentarioSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  mensaje: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  }
}, {
  timestamps: true,
  _id: true
});
const tareaSchema = new mongoose.Schema({
  descripcion: {
    type: String,
    required: true,
  },
  estado: {
    type: String,
    enum: ["Pendiente", "En Proceso", "Completada"],
    default: "Pendiente",
  },
  tipo: {
    type: String,
    enum: ["Logistica", "Preparacion", "Compra", "General"],
    default: "General",
  }
});

const historialSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario"
  },

  accion: {
    type: String,
    enum: [
      "CREACION",
      "MODIFICACION",
      "CAMBIO_ESTADO",
      "APROBACION",
      "RECHAZO",
      "FINALIZACION",
      "COMENTARIO",
      "ELIMINACION"
    ]
  },

  descripcion: String,

  cambios: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }

}, {
  timestamps: true
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
  duracionClase: {
    type: Number,
    required: true,
  },
  fechaInicioReal: {
    type: Date,
  },
  fechaFinReal: {
    type: Date,
  },
  laboratorio: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Laboratorio",
    required: false,
    default: null,
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
  checklist: {
    type: [tareaSchema],
    default: [],
  },
  activo: {
    type: Boolean,
    default: true,
    index: true,
  },
  comentarios: [comentarioSchema],
  vistoPor: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario"
    },
    ultimoComentarioVisto: {
      type: Date
    }
  }],
  historial: {
    type: [historialSchema],
    default: []
  },  
}, { 
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
}
);

// Índices para optimizar queries frecuentes
pedidoSchema.index({ docente: 1, estado: 1 });
pedidoSchema.index({ laboratorio: 1 });
pedidoSchema.index({ fechaHora: -1 });

// Validación pre-save
pedidoSchema.pre("save", function(next) {
  if (!this.recursos || this.recursos.length === 0) {
    return next(new Error("Un pedido debe tener al menos un recurso"));
  }
  next();
});

export default mongoose.models.Pedido || mongoose.model("Pedido", pedidoSchema);