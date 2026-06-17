import mongoose from "mongoose";

const descarteSchema = new mongoose.Schema({
  pedidoId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Pedido', 
    required: true,
    index: true 
  },
  reservaId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Reserva' 
  },
  tipo: { 
    type: String, 
    enum: ['material', 'reactivo', 'equipo'], 
    required: true 
  },
  itemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Item' 
  },
  equipoId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Equipo' 
  },
  cantidad: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  motivo: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 500
  },
  usuarioId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  lotesAfectados: [{
    loteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lote' },
    cantidad: { type: Number, required: true }
  }]
}, { timestamps: true });

// Índices para agilizar el historial de consultas
descarteSchema.index({ itemId: 1, createdAt: -1 });
descarteSchema.index({ equipoId: 1, createdAt: -1 });

export default mongoose.models.Descarte || mongoose.model('Descarte', descarteSchema);