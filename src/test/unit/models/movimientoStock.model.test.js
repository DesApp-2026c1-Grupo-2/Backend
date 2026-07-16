import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import MovimientoStock from '../../../models/movimientoStock.model.js';

describe('MovimientoStock Model Validations', () => {

  const base = () => ({
    itemId: new mongoose.Types.ObjectId(),
    tipoMovimiento: 'DESCARTE',
    cantidad: -2,
    cantidadAnterior: 10,
    cantidadNueva: 8,
  });

  it('es válido con los campos requeridos', () => {
    const mov = new MovimientoStock(base());
    expect(mov.validateSync()).toBeUndefined();
  });

  it('exige itemId, tipoMovimiento, cantidad, cantidadAnterior y cantidadNueva', () => {
    const mov = new MovimientoStock({});
    const err = mov.validateSync();

    expect(err).toBeDefined();
    expect(err.errors.itemId).toBeDefined();
    expect(err.errors.tipoMovimiento).toBeDefined();
    expect(err.errors.cantidad).toBeDefined();
    expect(err.errors.cantidadAnterior).toBeDefined();
    expect(err.errors.cantidadNueva).toBeDefined();
  });

  it('rechaza un tipoMovimiento fuera del enum', () => {
    const mov = new MovimientoStock({ ...base(), tipoMovimiento: 'INVENTADO' });
    const err = mov.validateSync();

    expect(err).toBeDefined();
    expect(err.errors.tipoMovimiento.name).toBe('ValidatorError');
  });

  it('acepta cantidad positiva (ingreso) sin origen/destino/usuario', () => {
    const mov = new MovimientoStock({
      ...base(),
      tipoMovimiento: 'COMPRA',
      cantidad: 50,
      cantidadAnterior: 0,
      cantidadNueva: 50,
    });
    expect(mov.validateSync()).toBeUndefined();
  });

});
