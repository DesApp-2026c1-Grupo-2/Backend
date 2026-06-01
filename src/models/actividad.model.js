const mongoose = require("mongoose");

const actividadSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  fecha: { type: Date, required: true },
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

module.exports = mongoose.model('Actividad', actividadSchema);