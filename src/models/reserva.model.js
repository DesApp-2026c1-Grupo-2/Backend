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
    enum: ['Pendiente', 'En Curso', 'Finalizada', 'Cancelada'], 
    default: 'Pendiente' 
  },
  equiposReservados: [{
    equipoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipo', required: true }
  }],
  materialesReservados: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    cantidadTotal: { type: Number, required: true },
    lotesUsados: [{
      loteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lote', required: true },
      cantidad: { type: Number, required: true }
    }]
  }]
}, { timestamps: true });

reservaSchema.pre('save', function(next) {
  if (this.fechaHora && typeof this.duracionClase === 'number') {
    this.fechaInicioReal = new Date(this.fechaHora.getTime() - 60 * 60 * 1000);
    this.fechaFinReal = new Date(this.fechaHora.getTime() + (this.duracionClase + 30) * 60 * 1000);
  }
  next();
});

export default mongoose.models.Reserva || mongoose.model('Reserva', reservaSchema);