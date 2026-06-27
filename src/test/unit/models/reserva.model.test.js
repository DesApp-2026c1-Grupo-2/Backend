import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import Reserva from '../../../models/reserva.model.js';

describe('Reserva Model Validations', () => {
  
  it('debería ser válido con todas las referencias obligatorias y estado predeterminado', () => {
    const reserva = new Reserva({
      pedidoId: new mongoose.Types.ObjectId(),
      laboratorioId: new mongoose.Types.ObjectId(),
      docenteId: new mongoose.Types.ObjectId(),
      fechaHora: new Date(),
      duracionClase: 120,
    });

    const err = reserva.validateSync();
    expect(err).toBeUndefined();
    expect(reserva.estado).toBe('Pendiente'); // Comprueba el valor default
  });

  it('debería fallar si faltan referencias a otras colecciones (pedidoId, laboratorioId, docenteId, fechaHora)', () => {
    const reserva = new Reserva({});
    const err = reserva.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.pedidoId).toBeDefined();
    expect(err.errors.laboratorioId).toBeDefined();
    expect(err.errors.docenteId).toBeDefined();
    expect(err.errors.duracionClase).toBeDefined();
  });
});