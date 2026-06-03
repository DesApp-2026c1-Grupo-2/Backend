import { describe, it, expect } from 'vitest';
import Item from '../../../models/item.model.js';

describe('Item Model Validations', () => {
  
  it('debería ser válido si se proveen todos los campos obligatorios correctamente', () => {
    const item = new Item({
      tipo: 'reactivo',
      nombre: 'Ácido Clorhídrico',
      codigo: 'RCT-001',
      unidad: 'ml',
      esConsumible: true,
      requiereReceta: true
    });

    const err = item.validateSync();
    expect(err).toBeUndefined();
  });

  it('debería retornar error de validación si faltan campos obligatorios', () => {
    const item = new Item({});
    const err = item.validateSync();
    
    expect(err).toBeDefined();
    expect(err.errors.tipo).toBeDefined();
    expect(err.errors.nombre).toBeDefined();
    expect(err.errors.codigo).toBeDefined();
    expect(err.errors.unidad).toBeDefined();
    expect(err.errors.esConsumible).toBeDefined();
  });

  it('debería retornar error si el tipo no está dentro del enum permitido', () => {
    const item = new Item({
      tipo: 'tipo_invalido',
      nombre: 'Item Inválido',
      codigo: 'INV-1',
      unidad: 'g',
      esConsumible: true
    });

    const err = item.validateSync();
    expect(err.errors.tipo.name).toBe('ValidatorError');
  });

  it('debería retornar error por regla de validación custom si se requiere receta en un material', () => {
    const item = new Item({
      tipo: 'material', // Un material no puede requerir receta
      nombre: 'Tubo de Ensayo',
      codigo: 'MAT-1',
      unidad: 'unidad',
      esConsumible: false,
      requiereReceta: true // <-- Esto debería detonar la validación personalizada
    });
    const err = item.validateSync();
    expect(err.errors.requiereReceta.message).toBe('Solo los ítems de tipo reactivo pueden requerir receta.');
  });
});