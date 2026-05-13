const mongoose = require("mongoose");

const actividadSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  fecha: { type: Date, required: true },
  estado: { 
    type: String, 
    enum: ['planificada', 'en_proceso', 'finalizada'], 
    default: 'planificada' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Actividad', actividadSchema);