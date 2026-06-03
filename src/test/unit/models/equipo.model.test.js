import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import Equipo from '../../../models/equipo.model.js';

describe('Equipo Model Validations', () => {
  
  it('debería ser válido si se proveen todos los campos obligatorios correctamente', async () => {
    const equipo = new Equipo({
      nombre: 'Microscopio Digital',
      codigo: 'MIC-001',
      tipo: 'Óptico',
      esFijo: true,
      estado: 'disponible',
      laboratorioId: new mongoose.Types.ObjectId() // Requerido por el hook pre-validate de equipos fijos
    });

    // Usamos validate() asíncrono para ejecutar también los hooks pre('validate')
    let err;
    try {
      await equipo.validate();
    } catch (e) {
      err = e;
    }
    expect(err).toBeUndefined();
  });

  it('debería retornar error de validación si faltan campos obligatorios', () => {
    // Creamos un documento vacío
    const equipo = new Equipo({});

    const err = equipo.validateSync();
    expect(err).toBeDefined();
    expect(err.errors).toBeDefined();
    
    // Validamos que avise de las restricciones de schema típicas
    expect(err.errors.nombre).toBeDefined();
    expect(err.errors.codigo).toBeDefined();
    expect(err.errors.tipo).toBeDefined();
  });

  it('debería retornar error de validación al usar un Enum incorrecto para el campo "estado"', () => {
    const equipo = new Equipo({
      nombre: 'Centrífuga',
      codigo: 'CEN-123',
      tipo: 'Mecánico',
      esFijo: true,
      estado: 'estado_invalido' // Valor fuera de la enumeración definida ('disponible', 'mantenimiento', 'fuera de servicio')
    });

    const err = equipo.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.estado).toBeDefined();
    // El tipo de error emitido por Mongoose será 'ValidatorError' al quebrar una regla de enum
    expect(err.errors.estado.name).toBe('ValidatorError');
  });

  it('debería retornar error de validación si el nombre es menor a 2 caracteres', () => {
    const equipo = new Equipo({
      nombre: 'A',
      codigo: 'MIC-002',
      tipo: 'Óptico',
      esFijo: false
    });

    const err = equipo.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.nombre).toBeDefined();
    expect(err.errors.nombre.kind).toBe('minlength');
  });

  it('debería retornar error de validación si el nombre supera los 100 caracteres', () => {
    const equipo = new Equipo({
      nombre: 'A'.repeat(101),
      codigo: 'MIC-003',
      tipo: 'Óptico',
      esFijo: false
    });

    const err = equipo.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.nombre).toBeDefined();
    expect(err.errors.nombre.kind).toBe('maxlength');
  });

  it('debería invalidar (hook pre-validate) si esFijo es true y no tiene laboratorioId asignado', async () => {
    const equipo = new Equipo({
      nombre: 'Microscopio',
      codigo: 'MIC-004',
      tipo: 'Óptico',
      esFijo: true
    });

    let err;
    try { await equipo.validate(); } catch (e) { err = e; }

    expect(err).toBeDefined();
    expect(err.errors.laboratorioId).toBeDefined();
    expect(err.errors.laboratorioId.message).toBe('Un equipo fijo debe tener laboratorioId asignado');
  });

  it('debería invalidar (hook pre-validate) si esFijo es false y tiene laboratorioId asignado', async () => {
    const equipo = new Equipo({
      nombre: 'Microscopio Portátil',
      codigo: 'MIC-005',
      tipo: 'Óptico',
      esFijo: false,
      laboratorioId: new mongoose.Types.ObjectId()
    });

    let err;
    try { await equipo.validate(); } catch (e) { err = e; }

    expect(err).toBeDefined();
    expect(err.errors.laboratorioId).toBeDefined();
    expect(err.errors.laboratorioId.message).toBe('Un equipo móvil no debe tener laboratorioId');
  });

  it('debería transformar correctamente el _id a id y eliminar __v al serializar a JSON', () => {
    const mockId = new mongoose.Types.ObjectId();
    const equipo = new Equipo({
      _id: mockId,
      nombre: 'Balanza',
      codigo: 'BAL-1',
      tipo: 'Mecánico',
      esFijo: false
    });

    const json = equipo.toJSON();
    expect(json.id).toBe(mockId.toString());
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });

});