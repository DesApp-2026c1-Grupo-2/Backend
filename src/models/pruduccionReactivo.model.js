const mongoose = require('mongoose');
/* Representa la producción de un reactivo a partir de su receta.
Cada vez que se produce un reactivo, se registra una entrada en esta colección que indica qué reactivo se produjo, qué sustancias se usaron (con sus cantidades) y cuánto se generó. 
Esto permite llevar un historial detallado de la producción de reactivos, rastrear el consumo de sustancias y calcular el stock real de cada reactivo teniendo en cuenta su producción y consumo.
*/

const produccionReactivoSchema = new mongoose.Schema({
  reactivoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  composicionReal: [{
    sustanciaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    cantidadUsada: { type: Number, required: true, min: 0 }
  }],
  cantidadGenerada: { type: Number, required: true, min: 0 },
  fecha: { type: Date, default: Date.now },
  actividadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Actividad' }
}, { timestamps: true });

module.exports = mongoose.model('ProduccionReactivo', produccionReactivoSchema);