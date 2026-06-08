import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import Pedido from '../../../models/pedido.model.js';

describe('Pedido Model Validations', () => {
  
  it('debería ser válido con todos los datos correctos', () => {
    const pedido = new Pedido({
      materia: 'Química I',
      docente: new mongoose.Types.ObjectId(),
      fechaHora: new Date(),
      laboratorio: new mongoose.Types.ObjectId(),
      alumnos: 30,
      recursos: [{
        recursoId: new mongoose.Types.ObjectId(),
        tipoRecurso: 'Item',
        cantidad: 5
      }]
    });

    const err = pedido.validateSync();
    expect(err).toBeUndefined();
  });

  it('debería retornar error de validación si faltan campos requeridos (materia, docente, laboratorio, alumnos)', () => {
    const pedido = new Pedido({});
    const err = pedido.validateSync();
    
    expect(err).toBeDefined();
    expect(err.errors.materia).toBeDefined();
    expect(err.errors.docente).toBeDefined();
    expect(err.errors.laboratorio).toBeDefined();
    expect(err.errors.alumnos).toBeDefined();
    expect(err.errors.fechaHora).toBeDefined();
  });

  it('debería retornar error si el campo estado contiene un valor fuera de la enumeración permitida', () => {
    const pedido = new Pedido({
      materia: 'Biología Avanzada',
      docente: new mongoose.Types.ObjectId(),
      fechaHora: new Date(),
      laboratorio: new mongoose.Types.ObjectId(),
      alumnos: 15,
      estado: 'estado_inexistente' // Solo permite: "Pendiente", "En Revisión", "Aceptado", "Rechazado", "Finalizado"
    });
    const err = pedido.validateSync();
    expect(err.errors.estado.name).toBe('ValidatorError');
  });
});