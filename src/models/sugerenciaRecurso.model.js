import mongoose from "mongoose";

const sugerenciaRecursoSchema = new mongoose.Schema({
  tipoActividad: {
    type: String,
    enum: ['quimica', 'biologia', 'teorica'],
    required: true,
    index: true
  },

  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    default: null
  },

  equipoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equipo',
    default: null
  },

  cantidadSugerida: {
    type: Number,
    required: true,
    min: 1
  },

  orden: {
    type: Number,
    default: 0
  },

  activo: {
    type: Boolean,
    default: true,
    index: true
  }
}, { timestamps: true });

sugerenciaRecursoSchema.index({ tipoActividad: 1, activo: 1 });

sugerenciaRecursoSchema.index(
  { tipoActividad: 1, itemId: 1 },
  { unique: true, partialFilterExpression: { itemId: { $exists: true, $ne: null } } }
);

sugerenciaRecursoSchema.index(
  { tipoActividad: 1, equipoId: 1 },
  { unique: true, partialFilterExpression: { equipoId: { $exists: true, $ne: null } } }
);


export default mongoose.models.SugerenciaRecurso || mongoose.model('SugerenciaRecurso', sugerenciaRecursoSchema);