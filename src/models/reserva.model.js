import mongoose from "mongoose";

/* Representa la asignación concreta de tiempo, espacio y recursos físicos.
Se genera automáticamente tras la aprobación de un Pedido.
Consolida los lotes específicos de donde se descontó el stock para mantener un registro histórico trazable. */

const reservaSchema = new mongoose.Schema({
  pedidoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pedido', required: true, unique: true },
  laboratorioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Laboratorio', required: true },
  docenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  fechaHora: { type: Date, required: true },
  duracionClase: { type: Number, required: true },
  fechaInicioReal: { type: Date },
  fechaFinReal: { type: Date },
  estado: {
    type: String,
    // 'Conflicto' se usa para fallos de ejecución del consumo físico
    // 'Conflicto' deja de restar disponibilidad (no está en {Pendiente, En Curso}).
    enum: ['Pendiente', 'En Curso', 'Finalizada', 'Cancelada', 'Conflicto'],
    default: 'Pendiente'
  },
  equiposReservados: [{
    equipoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipo', required: true }
  }],
  materialesReservados: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    cantidadTotal: { type: Number, required: true },
    // Consumo físico real reportado al finalizar (PATCH /reservas/:id/finalizar o
    // PATCH /pedidos/:id/finalizar). Dato de negocio: cuánto se usó realmente.
    // Para reutilizables no aplica (vuelven completos). Su ausencia NO indica
    // "se consumió todo": el estado de liquidación lo lleva `liquidado`.
    cantidadConsumidaReal: { type: Number },
    // ¿Se ejecutó el descuento físico de este material (§7)? Se pone en true
    // recién cuando `ejecutarConsumoFisico` (cron) decrementa cantidadDisponible.
    // Mientras sea false, `lotesUsados` es solo un PUNTERO FIFO (aprobación) que
    // NUNCA salió del inventario: las devoluciones al finalizar deben ignorarlo
    // para no inyectar stock fantasma.
    consumoEjecutado: { type: Boolean, default: false },
    // ¿Ya se saldó el stock que salió por este material? Lo setean TANTO el cron
    // (devolverReutilizablesAlFinalizar, solo reutilizables) COMO la finalización
    // manual (aplicarDevolucionesFinalizacion) y la cancelación. Es el marcador de
    // idempotencia: mientras `consumoEjecutado && !liquidado` hay stock afuera sin
    // saldar, y tanto el gate que exige el consumo reportado como las devoluciones
    // deben actuar. Por material y no por reserva a propósito: permite que el cron
    // liquide los reutilizables al vencer la ventana y deje los consumibles
    // pendientes de reporte, para que el sobrante se recupere al finalizar el pedido.
    liquidado: { type: Boolean, default: false },
    lotesUsados: [{
      loteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lote', required: true },
      cantidad: { type: Number, required: true }
    }]
  }]
}, { timestamps: true });

// Índice de apoyo para las agregaciones de disponibilidad temporal
// que las queries no degraden a COLLSCAN.
reservaSchema.index({
  estado: 1,
  'materialesReservados.itemId': 1,
  fechaInicioReal: 1,
  fechaFinReal: 1
});

reservaSchema.pre('save', function() {
  if (this.fechaHora && typeof this.duracionClase === 'number') {
    this.fechaInicioReal = new Date(this.fechaHora.getTime() - 60 * 60 * 1000);
    this.fechaFinReal = new Date(this.fechaHora.getTime() + (this.duracionClase + 30) * 60 * 1000);
  }
});

export default mongoose.models.Reserva || mongoose.model('Reserva', reservaSchema);