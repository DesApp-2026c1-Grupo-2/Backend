const mongoose = require("mongoose");

/* Representa un item del inventario, que puede ser una sutancia, un reactivo o un material. 
No representa el stock físico, para eso se usa el modelo de lote. 
El item define las características generales (tipo, unidad, si es consumible o requiere receta), mientras que el lote maneja la cantidad física y su estado.
Haciendo una analogía con la Programación Orientada a Objetos cada documento osea cada fila en la base de datos de Item actúa como una Clase que define las características de un producto, 
mientras que el Lote es una Instancia concreta de ese producto, manteniendo el estado físico real (como cantidad, ubicación y fecha de vencimiento).
*/


const itemSchema = new mongoose.Schema({
  tipo: { 
    type: String, 
    enum: ['sustancia', 'reactivo', 'material', 'equipo'], 
    required: true 
  },
  nombre: { type: String, required: true },
  codigo: { type: String, required: true, unique: true, index: true },
  unidad: { type: String, required: true }, // ej: 'g', 'ml', 'unidad'
  esConsumible: { type: Boolean, required: true },
  requiereReceta: { 
    type: Boolean, 
    default: false,
    validate: {
      validator: function(v) {
        // Solo los reactivos pueden requerir receta
        // Para otros tipos (material, sustancia, equipo), debe ser false o puede ser omitido (default false)
        if (this.tipo === 'reactivo') {
          return true; // Los reactivos pueden ser true o false
        }
        // Para otros tipos, solo permitir false (o default)
        return v === false || v === undefined;
      },
      message: 'Solo los ítems de tipo reactivo pueden requerir receta.'
    }
  },
  activo: {
    type: Boolean,
    default: true,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);