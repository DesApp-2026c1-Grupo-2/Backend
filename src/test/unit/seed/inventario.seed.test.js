import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks de modelos ANTES de importar el seeder.
vi.mock('../../../models/item.model.js');
vi.mock('../../../models/lote.model.js');
vi.mock('../../../models/actividad.model.js');
vi.mock('../../../models/recetaReactivo.model.js');
vi.mock('../../../models/produccionReactivo.model.js');

import Item from '../../../models/item.model.js';
import Lote from '../../../models/lote.model.js';
import Actividad from '../../../models/actividad.model.js';
import RecetaReactivo from '../../../models/recetaReactivo.model.js';
import ProduccionReactivo from '../../../models/produccionReactivo.model.js';
import { seedInventario } from '../../../seed/inventario.seed.js';

const REUTILIZABLES = ['MAT-001', 'MAT-002', 'MAT-004'];

describe('seedInventario', () => {
  let itemsInsertados;
  let lotesInsertados;

  beforeEach(async () => {
    vi.clearAllMocks();

    // deleteMany de todas las colecciones
    Item.deleteMany.mockResolvedValue({});
    Lote.deleteMany.mockResolvedValue({});
    RecetaReactivo.deleteMany.mockResolvedValue({});
    ProduccionReactivo.deleteMany.mockResolvedValue({});

    // Item.insertMany devuelve los ítems con _id (el seed usa codigo/_id/esConsumible)
    Item.insertMany.mockImplementation((arr) => {
      itemsInsertados = arr;
      return Promise.resolve(arr.map((x) => ({ ...x, _id: 'id_' + x.codigo })));
    });

    Lote.insertMany.mockImplementation((arr) => {
      lotesInsertados = arr;
      return Promise.resolve(arr);
    });

    Actividad.find.mockResolvedValue([
      { _id: 'act_prep', nombre: 'Preparación de Soluciones' },
    ]);
    RecetaReactivo.insertMany.mockResolvedValue([]);
    ProduccionReactivo.insertMany.mockResolvedValue([]);

    await seedInventario();
  });

  it('inserta el catálogo de ítems con Etanol como consumible', () => {
    expect(Item.insertMany).toHaveBeenCalledTimes(1);
    const etanol = itemsInsertados.find((i) => i.codigo === 'REA-003');
    expect(etanol.esConsumible).toBe(true);
  });

  it('todos los lotes referencian a un ítem', () => {
    expect(lotesInsertados.length).toBeGreaterThan(0);
    expect(lotesInsertados.every((l) => typeof l.itemId === 'string')).toBe(true);
  });

  it('los reutilizables no tienen vencimiento y los consumibles sí', () => {
    for (const lote of lotesInsertados) {
      const codigo = lote.itemId.replace('id_', '');
      if (REUTILIZABLES.includes(codigo)) {
        expect(lote.fechaVencimiento).toBeNull();
      } else {
        expect(lote.fechaVencimiento).toBeInstanceOf(Date);
      }
    }
  });

  it('incluye un lote descartado con cantidad 0 (para el "total excluye descartados" §14)', () => {
    const descartado = lotesInsertados.find((l) => l.estado === 'descartado');
    expect(descartado).toBeDefined();
    expect(descartado.cantidadDisponible).toBe(0);
  });

  it('incluye al menos un lote consumible próximo a vencer (< 30 días)', () => {
    const limite = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const proximo = lotesInsertados.some(
      (l) => l.fechaVencimiento instanceof Date && l.fechaVencimiento.getTime() < limite
    );
    expect(proximo).toBe(true);
  });

  it('las fechas de creación están escalonadas (FIFO significativo, no todas iguales)', () => {
    const creaciones = new Set(
      lotesInsertados.map((l) => l.fechaCreacion && l.fechaCreacion.getTime())
    );
    expect(creaciones.size).toBeGreaterThan(1);
  });

  it('registra la receta y la producción del reactivo con receta', () => {
    expect(RecetaReactivo.insertMany).toHaveBeenCalledTimes(1);
    expect(ProduccionReactivo.insertMany).toHaveBeenCalledTimes(1);
  });
});
