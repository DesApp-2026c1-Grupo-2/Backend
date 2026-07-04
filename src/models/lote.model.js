import mongoose from "mongoose";

/* Representa un lote de un ítem específico en el inventario.
Un lote es una cantidad física de un ítem que puede estar en diferentes estados (disponible, descartado).
Todo lote está asociado a un ítem (referencia a Item). El vínculo stock↔uso se modela vía Reserva.materialesReservados.lotesUsados, no sobre el lote.
Todas las operaciones de stock se realizan a nivel de lote, no directamente sobre el ítem.
El item solamente se utiliza par definir las características generales (tipo, unidad, si es consumible o requiere receta), mientras que el lote maneja la cantidad física y su estado.
Es importante destacar que el lote es la unidad de gestión del stock y no el ítem, ya que un mismo ítem puede tener múltiples lotes con diferentes cantidades y estados.
*/

const loteSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  cantidadDisponible: { type: Number, required: true, min: 0 },
  ubicacion: { type: String, required: true },
  estado: {
    type: String,
    enum: ['disponible', 'descartado'],
    default: 'disponible'
  },
  // Fecha en que se creó/recibió la TANDA FÍSICA del lote. No confundir con
  // `createdAt` (timestamps), que es cuándo se insertó la fila en la BD: un lote
  // recibido hace meses puede darse de alta hoy (el seed la retrodata para
  // simular lotes viejos). Se usa como desempate del FIFO en la asignación de
  // stock — sort: { fechaVencimiento: 1, fechaCreacion: 1 } (ver aprobacionReserva.js / cronReservas.js).
  fechaCreacion: { type: Date, default: Date.now },
  fechaVencimiento: { type: Date },
  activo: {
    type: Boolean,
    default: true,
    index: true
  }
}, { timestamps: true });

// Índice para optimizar el cálculo de stock
loteSchema.index({ itemId: 1, estado: 1 });

loteSchema.statics.calcularStockDisponible = async function(itemId) {
  const resultado = await this.aggregate([
    { 
      $match: { 
        itemId: new mongoose.Types.ObjectId(itemId),
        estado: 'disponible',
        activo: { $ne: false }
      } 
    },
    { 
      $group: { 
        _id: '$itemId', 
        stockTotal: { $sum: '$cantidadDisponible' } 
      } 
    }
  ]);

  return resultado.length > 0 ? resultado[0].stockTotal : 0;
};

export default mongoose.models.Lote || mongoose.model('Lote', loteSchema);