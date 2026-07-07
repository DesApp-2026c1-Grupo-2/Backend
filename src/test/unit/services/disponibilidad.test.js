import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks de modelos ANTES de importar el servicio bajo prueba.
vi.mock('../../../models/item.model.js');
vi.mock('../../../models/lote.model.js');
vi.mock('../../../models/reserva.model.js');

import Item from '../../../models/item.model.js';
import Lote from '../../../models/lote.model.js';
import Reserva from '../../../models/reserva.model.js';
import { calcularDisponibilidad, desgloseStock } from '../../../services/disponibilidad.js';

// id hexadecimal válido para que `new mongoose.Types.ObjectId(itemId)` no falle.
const ITEM_ID = '507f1f77bcf86cd799439011';
const INICIO = new Date('2026-07-01T10:00:00Z');
const FIN = new Date('2026-07-01T12:00:00Z');

// Item.findById(itemId).session(session)
const mockItem = (item) => {
  Item.findById.mockReturnValue({ session: vi.fn().mockResolvedValue(item) });
};

describe('calcularDisponibilidad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 0 si el item no existe', async () => {
    mockItem(null);

    const resultado = await calcularDisponibilidad(ITEM_ID, INICIO, FIN);

    expect(resultado).toBe(0);
    // No debe intentar leer stock si el item no existe.
    expect(Lote.aggregate).not.toHaveBeenCalled();
  });

  describe('item reutilizable (esConsumible = false) — modelo temporal', () => {
    it('resta lo reservado en ventanas que solapan', async () => {
      mockItem({ _id: ITEM_ID, esConsumible: false });
      Lote.aggregate.mockResolvedValue([{ _id: ITEM_ID, total: 100 }]);
      Reserva.aggregate.mockResolvedValue([{ _id: null, total: 30 }]);

      const resultado = await calcularDisponibilidad(ITEM_ID, INICIO, FIN);

      expect(resultado).toBe(70);
    });

    it('devuelve el stock total cuando no hay reservas solapadas', async () => {
      mockItem({ _id: ITEM_ID, esConsumible: false });
      Lote.aggregate.mockResolvedValue([{ _id: ITEM_ID, total: 40 }]);
      Reserva.aggregate.mockResolvedValue([]);

      const resultado = await calcularDisponibilidad(ITEM_ID, INICIO, FIN);

      expect(resultado).toBe(40);
    });

    it('filtra reservas por estado {Pendiente, En Curso} y solapamiento de ventana', async () => {
      mockItem({ _id: ITEM_ID, esConsumible: false });
      Lote.aggregate.mockResolvedValue([{ total: 10 }]);
      Reserva.aggregate.mockResolvedValue([]);

      await calcularDisponibilidad(ITEM_ID, INICIO, FIN);

      const pipeline = Reserva.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match.estado).toEqual({ $in: ['Pendiente', 'En Curso'] });
      expect(pipeline[0].$match.fechaInicioReal).toEqual({ $lt: FIN });
      expect(pipeline[0].$match.fechaFinReal).toEqual({ $gt: INICIO });
    });
  });

  describe('item consumible (esConsumible = true) — pool finito acumulado', () => {
    it('resta el consumo acumulado de reservas Pendiente', async () => {
      mockItem({ _id: ITEM_ID, esConsumible: true });
      Lote.aggregate.mockResolvedValue([{ total: 50 }]);
      Reserva.aggregate.mockResolvedValue([{ _id: null, total: 20 }]);

      const resultado = await calcularDisponibilidad(ITEM_ID, INICIO, FIN);

      expect(resultado).toBe(30);
    });

    it('solo cuenta reservas Pendiente que consumen antes o durante la ventana', async () => {
      mockItem({ _id: ITEM_ID, esConsumible: true });
      Lote.aggregate.mockResolvedValue([{ total: 5 }]);
      Reserva.aggregate.mockResolvedValue([]);

      await calcularDisponibilidad(ITEM_ID, INICIO, FIN);

      const pipeline = Reserva.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match.estado).toBe('Pendiente');
      expect(pipeline[0].$match.fechaInicioReal).toEqual({ $lt: FIN });
      // No acota por fechaFinReal: es un pool acumulado, no un solapamiento.
      expect(pipeline[0].$match.fechaFinReal).toBeUndefined();
    });

    it('devuelve el stock total cuando no hay consumo pendiente', async () => {
      mockItem({ _id: ITEM_ID, esConsumible: true });
      Lote.aggregate.mockResolvedValue([{ total: 15 }]);
      Reserva.aggregate.mockResolvedValue([]);

      const resultado = await calcularDisponibilidad(ITEM_ID, INICIO, FIN);

      expect(resultado).toBe(15);
    });
  });
});

describe('desgloseStock (vista de gestión §14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compone total, disponible y el desglose de aceptado/enUso por reserva', async () => {
    // Item reutilizable (esConsumible=false) usado por calcularDisponibilidad.
    mockItem({ _id: ITEM_ID, esConsumible: false });

    // Lote.aggregate se usa tanto para el total físico como para el nominal;
    // ambos devuelven 20 en este caso.
    Lote.aggregate.mockResolvedValue([{ total: 20 }]);

    // Reserva.aggregate se bifurca según el $match.estado:
    //  - {$in:['Pendiente','En Curso']} → rama reutilizable de calcularDisponibilidad
    //  - 'Pendiente'  → desglose "aceptado"
    //  - 'En Curso'   → desglose "enUso"
    Reserva.aggregate.mockImplementation((pipeline) => {
      const estado = pipeline[0].$match.estado;
      if (typeof estado === 'object') {
        return Promise.resolve([{ total: 5 }]); // reservado en ventana
      }
      if (estado === 'Pendiente') {
        return Promise.resolve([
          { cantidad: 5, fechaInicioReal: INICIO, fechaFinReal: FIN, pedidoId: 'ped_1' },
        ]);
      }
      return Promise.resolve([]); // 'En Curso'
    });

    const resultado = await desgloseStock(ITEM_ID, INICIO, FIN);

    expect(resultado.total).toBe(20);
    expect(resultado.disponible).toBe(15); // 20 - 5 reservado
    expect(resultado.aceptado).toEqual([
      { cantidad: 5, fechaInicioReal: INICIO, fechaFinReal: FIN, pedidoId: 'ped_1' },
    ]);
    expect(resultado.enUso).toEqual([]);
  });

  it('para consumibles, "aceptado" usa el criterio acumulado (no acota por fechaFinReal), igual que disponible', async () => {
    mockItem({ _id: ITEM_ID, esConsumible: true });
    Lote.aggregate.mockResolvedValue([{ total: 50 }]);
    Reserva.aggregate.mockImplementation((pipeline) => {
      const estado = pipeline[0].$match.estado;
      // calcularDisponibilidad agrega con $group→total; reservasEnVentana proyecta el desglose.
      const esAgregado = pipeline.some((stage) => stage.$group);
      if (esAgregado) {
        return Promise.resolve([{ _id: null, total: 20 }]);
      }
      if (estado === 'Pendiente') {
        return Promise.resolve([
          { cantidad: 20, fechaInicioReal: INICIO, fechaFinReal: FIN, pedidoId: 'ped_1' },
        ]);
      }
      return Promise.resolve([]); // 'En Curso'
    });

    const resultado = await desgloseStock(ITEM_ID, INICIO, FIN);

    // disponible = 50 - 20 (acumulado Pendiente); aceptado lista esa misma reserva.
    expect(resultado.disponible).toBe(30);
    expect(resultado.aceptado).toEqual([
      { cantidad: 20, fechaInicioReal: INICIO, fechaFinReal: FIN, pedidoId: 'ped_1' },
    ]);

    // El $match de "aceptado" (Pendiente) NO debe acotar por fechaFinReal.
    const matchAceptado = Reserva.aggregate.mock.calls
      .map((c) => c[0][0].$match)
      .find((m) => m.estado === 'Pendiente');
    expect(matchAceptado.fechaInicioReal).toEqual({ $lt: FIN });
    expect(matchAceptado.fechaFinReal).toBeUndefined();
  });

  it('el total físico excluye lotes descartados/inactivos (estado ≠ descartado)', async () => {
    mockItem({ _id: ITEM_ID, esConsumible: false });
    Lote.aggregate.mockResolvedValue([{ total: 0 }]);
    Reserva.aggregate.mockResolvedValue([]);

    await desgloseStock(ITEM_ID, INICIO, FIN);

    // El primer uso de Lote.aggregate (total físico) filtra estado ≠ 'descartado'.
    const pipelineTotal = Lote.aggregate.mock.calls[0][0];
    expect(pipelineTotal[0].$match.estado).toEqual({ $ne: 'descartado' });
    expect(pipelineTotal[0].$match.activo).toEqual({ $ne: false });
  });
});
