import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import HistorialMantenimiento from '../../../models/historialMantenimiento.model.js';

describe('HistorialMantenimiento Model Validations', () => {

  it('debería ser válido con los campos obligatorios (equipoId y tipo)', async () => {
    const registro = new HistorialMantenimiento({
      equipoId: new mongoose.Types.ObjectId(),
      tipo: 'preventivo',
    });

    let err;
    try {
      await registro.validate();
    } catch (e) {
      err = e;
    }
    expect(err).toBeUndefined();
  });

  it('debería aplicar "ahora" como fecha por defecto y dejar fin en null (mantenimiento abierto)', () => {
    const registro = new HistorialMantenimiento({
      equipoId: new mongoose.Types.ObjectId(),
      tipo: 'correctivo',
    });

    expect(registro.fecha).toBeInstanceOf(Date);
    expect(registro.fin).toBeNull();
  });

  it('debería retornar error de validación si faltan campos obligatorios', () => {
    const registro = new HistorialMantenimiento({});

    const err = registro.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.equipoId).toBeDefined();
    expect(err.errors.tipo).toBeDefined();
  });

  it('debería retornar error de validación con un tipo fuera del enum', () => {
    const registro = new HistorialMantenimiento({
      equipoId: new mongoose.Types.ObjectId(),
      tipo: 'urgente', // fuera de ('preventivo', 'correctivo')
    });

    const err = registro.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.tipo).toBeDefined();
    expect(err.errors.tipo.name).toBe('ValidatorError');
  });

  it('debería invalidar (hook pre-validate) si fin es anterior a fecha', async () => {
    const registro = new HistorialMantenimiento({
      equipoId: new mongoose.Types.ObjectId(),
      tipo: 'preventivo',
      fecha: new Date('2026-01-10T10:00:00.000Z'),
      fin: new Date('2026-01-05T10:00:00.000Z'),
    });

    let err;
    try { await registro.validate(); } catch (e) { err = e; }

    expect(err).toBeDefined();
    expect(err.errors.fin).toBeDefined();
    expect(err.errors.fin.message).toBe('La fecha de fin no puede ser anterior a la fecha de inicio');
  });

  it('debería ser válido si fin es posterior a fecha (mantenimiento cerrado)', async () => {
    const registro = new HistorialMantenimiento({
      equipoId: new mongoose.Types.ObjectId(),
      tipo: 'correctivo',
      fecha: new Date('2026-01-10T10:00:00.000Z'),
      fin: new Date('2026-01-12T10:00:00.000Z'),
    });

    let err;
    try { await registro.validate(); } catch (e) { err = e; }
    expect(err).toBeUndefined();
  });

  it('debería retornar error de validación si la descripción supera los 500 caracteres', () => {
    const registro = new HistorialMantenimiento({
      equipoId: new mongoose.Types.ObjectId(),
      tipo: 'preventivo',
      descripcion: 'a'.repeat(501),
    });

    const err = registro.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.descripcion).toBeDefined();
    expect(err.errors.descripcion.kind).toBe('maxlength');
  });

  it('debería transformar _id a id y eliminar __v al serializar a JSON', () => {
    const mockId = new mongoose.Types.ObjectId();
    const registro = new HistorialMantenimiento({
      _id: mockId,
      equipoId: new mongoose.Types.ObjectId(),
      tipo: 'preventivo',
    });

    const json = registro.toJSON();
    expect(json.id).toBe(mockId.toString());
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });

});
