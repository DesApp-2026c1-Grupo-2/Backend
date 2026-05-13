const mongoose = require("mongoose");
/* Representa la receta maestra de un reactivo, que define su composición en términos de las sustancias que lo conforman y sus cantidades.
Cada reactivo tiene una receta única que especifica qué sustancias se necesitan para producirlo y en qué cantidades. 
Esta información es esencial para calcular el stock real de cada reactivo, teniendo en cuenta su producción (que aumenta el stock) y su consumo (que lo disminuye). 
La receta se utiliza como referencia para validar la producción de reactivos y para calcular el consumo de sustancias cuando se producen o consumen reactivos.
*/
const recetaReactivoSchema = new mongoose.Schema({
  reactivoId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Item', 
    required: true,
    unique: true // Asumiendo una receta maestra por reactivo
  },
  composicion: [{
    sustanciaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    cantidad: { type: Number, required: true, min: 0 },
    unidad: { type: String, required: true }
  }]
}, { timestamps: true });

module.exports = mongoose.model('RecetaReactivo', recetaReactivoSchema);