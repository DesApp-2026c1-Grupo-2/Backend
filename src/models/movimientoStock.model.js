import mongoose from "mongoose";

/*
 * Historial de movimientos de stock (ver docs/Diseno_Historial_Movimientos_Stock.md).
 *
 * Fuente de verdad de auditoría de TODO cambio del stock físico del inventario.
 * Un MovimientoStock existe si y solo si cambió el `cantidadDisponible` físico de
 * un item (invariante: cantidadNueva = cantidadAnterior + cantidad, con `cantidad`
 * signada). Por eso la aprobación de reservas reutilizables —que en el modelo
 * temporal NO decrementa stock— no genera movimiento; sí lo generan el consumo
 * físico de consumibles al iniciar la reserva, los descartes de reutilizables y
 * el alta/ajuste/baja de lotes.
 *
 * `cantidadAnterior`/`cantidadNueva` se refieren al STOCK FÍSICO AGREGADO del item
 * (suma de cantidadDisponible de sus lotes disponibles), no al lote individual.
 *
 * EXCEPCIÓN — movimientos de UBICACIÓN (`TRANSFERENCIA` y la `DEVOLUCION` de un lote
 * que vuelve al depósito por traslado): mueven un lote entre depósito y laboratorios sin
 * cambiar el stock agregado del item. Se registran con `cantidad = 0` y
 * `cantidadAnterior == cantidadNueva` (el agregado no se mueve); el detalle del traslado
 * vive en `loteId`, `origenLaboratorioId`, `destinoLaboratorioId` y `observacion`.
 *
 * Las demás `DEVOLUCION` son ingresos físicos REALES (`cantidad > 0`) que respetan el
 * invariante: reposición de stock al cancelar una reserva, devolución del reutilizable al
 * finalizar (§10, vuelve el 100% de lo que salió) y devolución del sobrante de consumible
 * en la finalización manual (reservado − consumido).
 */
const movimientoStockSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
    index: true
  },
  tipoMovimiento: {
    type: String,
    enum: [
      'APROBACION_RESERVA', // consumo físico de consumibles al iniciar la reserva
      'DEVOLUCION',
      'DESCARTE',
      'COMPRA',             // alta de lote (ingreso de stock)
      'AJUSTE_MANUAL',
      'TRANSFERENCIA',      // traslado de lote entre depósito/laboratorios (sin cambio de agregado)
      'BAJA'                // baja lógica de lote
    ],
    required: true,
    index: true
  },
  // Delta físico signado (negativo = egreso, positivo = ingreso).
  cantidad: { type: Number, required: true },
  // Foto del stock físico agregado del item antes/después del movimiento.
  cantidadAnterior: { type: Number, required: true },
  cantidadNueva: { type: Number, required: true },
  origenLaboratorioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Laboratorio'
  },
  destinoLaboratorioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Laboratorio'
  },
  reservaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reserva',
    index: true
  },
  // Lote concreto afectado, cuando el movimiento nace de una operación sobre un
  // único lote (alta/ajuste/baja). En movimientos multi-lote (FIFO) queda vacío.
  loteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lote'
  },
  // Opcional: los movimientos generados por el sistema (cron de consumo) no
  // tienen usuario asociado.
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  observacion: { type: String, trim: true, maxlength: 500 }
}, { timestamps: true });

// El campo `fecha` del diseño se materializa vía `createdAt` (timestamps),
// igual que el modelo Descarte. Índices para las pantallas del historial:
movimientoStockSchema.index({ itemId: 1, createdAt: -1 });
movimientoStockSchema.index({ tipoMovimiento: 1, createdAt: -1 });

export default mongoose.models.MovimientoStock
  || mongoose.model('MovimientoStock', movimientoStockSchema);
