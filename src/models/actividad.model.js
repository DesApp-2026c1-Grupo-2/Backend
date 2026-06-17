import mongoose from "mongoose";

const actividadSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  fecha: { type: Date, required: true },
  tipo: {
    type: String,
    enum: ['quimica', 'biologia', 'teorica'],
    required: true,
    index: true
  },
  estado: { 
    type: String, 
    enum: ['planificada', 'en_proceso', 'finalizada'], 
    default: 'planificada' 
  }
  ,
  activo: {
    type: Boolean,
    default: true,
    index: true
  }
}, { timestamps: true });

export default mongoose.models.Actividad || mongoose.model('Actividad', actividadSchema);