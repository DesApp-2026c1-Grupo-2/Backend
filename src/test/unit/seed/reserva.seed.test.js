import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../models/reserva.model.js');
vi.mock('../../../models/pedido.model.js');
vi.mock('../../../models/item.model.js');
vi.mock('../../../models/lote.model.js');

import Reserva from '../../../models/reserva.model.js';
import Pedido from '../../../models/pedido.model.js';
import Item from '../../../models/item.model.js';
import Lote from '../../../models/lote.model.js';
import { seedReservas } from '../../../seed/reserva.seed.js';

const DIA = 24 * 60 * 60 * 1000;

describe('seedReservas', () => {
  let insertadas;
  let loteConsumible;
  let loteReutilizable;

  beforeEach(async () => {
    vi.clearAllMocks();

    Reserva.deleteMany.mockResolvedValue({});

    // Pedidos que fuerzan las tres ventanas: pasada, actual y futura.
    const pedidos = [
      {
        _id: 'ped_fin',
        estado: 'Finalizado',
        fechaHora: new Date(Date.now() - 10 * DIA), // pasado → Finalizada
        duracionClase: 120,
        laboratorio: 'lab1',
        docente: 'doc1',
        recursos: [
          { tipoRecurso: 'Equipo', recursoId: 'eq1', cantidad: 1 },
          { tipoRecurso: 'Item', recursoId: 'itC', cantidad: 10 }, // consumible
        ],
      },
      {
        _id: 'ped_curso',
        estado: 'Aceptado',
        fechaHora: new Date(Date.now() - 20 * 60 * 1000), // arrancó hace 20' → En Curso
        duracionClase: 120,
        laboratorio: 'lab2',
        docente: 'doc1',
        recursos: [{ tipoRecurso: 'Item', recursoId: 'itC', cantidad: 5 }],
      },
      {
        _id: 'ped_pend',
        estado: 'Aceptado',
        fechaHora: new Date(Date.now() + 3 * DIA), // futuro → Pendiente
        duracionClase: 120,
        laboratorio: 'lab3',
        docente: 'doc1',
        recursos: [
          { tipoRecurso: 'Item', recursoId: 'itC', cantidad: 7 }, // consumible, NO debe consumir
          { tipoRecurso: 'Item', recursoId: 'itR', cantidad: 3 }, // reutilizable
        ],
      },
    ];
    Pedido.find.mockResolvedValue(pedidos);

    // esConsumible por item
    const itemsMap = {
      itC: { _id: 'itC', esConsumible: true },
      itR: { _id: 'itR', esConsumible: false },
    };
    Item.findById.mockImplementation((id) => Promise.resolve(itemsMap[id]));

    // Lotes por item (objetos con save() espiable). Pool compartido entre reservas.
    loteConsumible = { _id: 'lc1', cantidadDisponible: 100, save: vi.fn().mockResolvedValue(true) };
    loteReutilizable = { _id: 'lr1', cantidadDisponible: 50, save: vi.fn().mockResolvedValue(true) };
    const lotesPorItem = { itC: [loteConsumible], itR: [loteReutilizable] };
    Lote.find.mockImplementation((query) => ({
      sort: () => Promise.resolve(lotesPorItem[query.itemId] || []),
    }));

    Reserva.insertMany.mockImplementation((arr) => {
      insertadas = arr;
      return Promise.resolve(arr);
    });

    await seedReservas();
  });

  it('deriva el estado de cada reserva de su ventana (Finalizada/En Curso/Pendiente)', () => {
    expect(insertadas).toHaveLength(3);
    const porPedido = Object.fromEntries(insertadas.map((r) => [r.pedidoId, r.estado]));
    expect(porPedido['ped_fin']).toBe('Finalizada');
    expect(porPedido['ped_curso']).toBe('En Curso');
    expect(porPedido['ped_pend']).toBe('Pendiente');
  });

  it('mapea los equipos reservados', () => {
    const fin = insertadas.find((r) => r.pedidoId === 'ped_fin');
    expect(fin.equiposReservados).toEqual([{ equipoId: 'eq1' }]);
  });

  it('consume stock físico solo de consumibles en reservas ejecutadas (§7)', () => {
    // Finalizada consumió 10 + En Curso consumió 5 = 15 del pool consumible.
    // La Pendiente (7) NO debe consumir → 100 - 15 = 85.
    expect(loteConsumible.cantidadDisponible).toBe(85);
    expect(loteConsumible.save).toHaveBeenCalled();
  });

  it('los reutilizables nunca decrementan stock', () => {
    expect(loteReutilizable.cantidadDisponible).toBe(50);
    expect(loteReutilizable.save).not.toHaveBeenCalled();
  });

  it('asigna punteros FIFO de lotes incluso en la reserva Pendiente (trazabilidad)', () => {
    const pend = insertadas.find((r) => r.pedidoId === 'ped_pend');
    const matConsumible = pend.materialesReservados.find((m) => m.itemId === 'itC');
    expect(matConsumible.lotesUsados.length).toBeGreaterThan(0);
    expect(matConsumible.lotesUsados[0]).toEqual({ loteId: 'lc1', cantidad: 7 });
  });
});
