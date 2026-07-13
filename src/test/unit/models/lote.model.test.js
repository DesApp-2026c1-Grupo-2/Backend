import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import Lote from '../../../models/lote.model.js';

describe('Lote Model Validations', () => {
  
  it('debería ser válido con todos los datos correctos', () => {
    const lote = new Lote({
      itemId: new mongoose.Types.ObjectId(),
      cantidadDisponible: 100,
      estado: 'disponible'
    });

    const err = lote.validateSync();
    expect(err).toBeUndefined();
  });

  it('debería retornar error de validación si faltan campos requeridos', () => {
    const lote = new Lote({});
    const err = lote.validateSync();
    
    expect(err).toBeDefined();
    expect(err.errors.itemId).toBeDefined();
    expect(err.errors.cantidadDisponible).toBeDefined();
  });

  it('debería retornar error si cantidadDisponible es menor a 0 (min validator)', () => {
    const lote = new Lote({
      itemId: new mongoose.Types.ObjectId(),
      cantidadDisponible: -5
    });

    const err = lote.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.cantidadDisponible.name).toBe('ValidatorError');
  });

});