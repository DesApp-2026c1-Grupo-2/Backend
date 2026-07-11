import { describe, it, expect, vi, beforeEach } from 'vitest';

// No se mockea mongoose: sin conexión activa, soportaTransacciones() falla en su
// try/catch y cae al camino degradado standalone (no transaccional), que es el
// que ejercitan estos tests.
vi.mock('../../../models/item.model.js');
vi.mock('../../../models/lote.model.js');
vi.mock('../../../models/reserva.model.js');
vi.mock('../../../services/disponibilidad.js');

import Item from '../../../models/item.model.js';
import Lote from '../../../models/lote.model.js';
import Reserva from '../../../models/reserva.model.js';
import { calcularDisponibilidad } from '../../../services/disponibilidad.js';
import {
  ConflictoStockError,
  asignarLotesFIFO,
  aprobarConReserva,
} from '../../../services/aprobacionReserva.js';

describe('ConflictoStockError', () => {
  it('expone itemId, disponible y solicitado con un mensaje legible', () => {
    const err = new ConflictoStockError('item_1', 3, 10);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConflictoStockError');
    expect(err.itemId).toBe('item_1');
    expect(err.disponible).toBe(3);
    expect(err.solicitado).toBe(10);
    expect(err.message).toContain('item_1');
    expect(err.message).toContain('3');
    expect(err.message).toContain('10');
  });
});

describe('asignarLotesFIFO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Lote.find({...}).sort({...}) => (await) lotes
  const mockLotes = (lotes) => {
    Lote.find.mockReturnValue({ sort: vi.fn().mockResolvedValue(lotes) });
  };

  it('asigna punteros FIFO cubriendo la cantidad entre varios lotes', async () => {
    mockLotes([
      { _id: 'l1', cantidadDisponible: 3 },
      { _id: 'l2', cantidadDisponible: 10 },
    ]);

    const usados = await asignarLotesFIFO('item_1', 5);

    expect(usados).toEqual([
      { loteId: 'l1', cantidad: 3 },
      { loteId: 'l2', cantidad: 2 },
    ]);
  });

  it('ordena por vencimiento y luego creación (FIFO)', async () => {
    const sort = vi.fn().mockResolvedValue([]);
    Lote.find.mockReturnValue({ sort });

    await asignarLotesFIFO('item_1', 1);

    expect(Lote.find).toHaveBeenCalledWith({
      itemId: 'item_1',
      estado: 'disponible',
      cantidadDisponible: { $gt: 0 },
    });
    expect(sort).toHaveBeenCalledWith({ fechaVencimiento: 1, fechaCreacion: 1 });
  });

  it('deja de asignar una vez cubierta la cantidad', async () => {
    mockLotes([
      { _id: 'l1', cantidadDisponible: 10 },
      { _id: 'l2', cantidadDisponible: 10 },
    ]);

    const usados = await asignarLotesFIFO('item_1', 4);

    expect(usados).toEqual([{ loteId: 'l1', cantidad: 4 }]);
  });

  it('NO decrementa cantidadDisponible de los lotes (solo puntero)', async () => {
    const lote = { _id: 'l1', cantidadDisponible: 10 };
    mockLotes([lote]);

    await asignarLotesFIFO('item_1', 4);

    expect(lote.cantidadDisponible).toBe(10);
  });
});

describe('aprobarConReserva (camino degradado standalone)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = () => ({
    datosReserva: { pedidoId: 'p1' },
    materiales: [
      { itemId: 'item_1', cantidadTotal: 5, lotesUsados: [] },
      { itemId: 'item_2', cantidadTotal: 2, lotesUsados: [] },
    ],
    inicio: new Date('2026-07-01T10:00:00Z'),
    fin: new Date('2026-07-01T12:00:00Z'),
  });

  it('fuerza la colisión de versión ($inc) y crea la reserva cuando hay stock', async () => {
    calcularDisponibilidad.mockResolvedValue(100);
    Reserva.create.mockResolvedValue([{ _id: 'r1' }]);

    const reserva = await aprobarConReserva(params());

    expect(reserva).toEqual({ _id: 'r1' });
    // Una colisión de versión por material.
    expect(Item.updateOne).toHaveBeenCalledTimes(2);
    expect(Item.updateOne).toHaveBeenCalledWith(
      { _id: 'item_1' },
      { $inc: { version: 1 } },
      {}
    );
    expect(Reserva.create).toHaveBeenCalledWith([params().datosReserva], {});
  });

  it('lanza ConflictoStockError si algún material no tiene disponibilidad', async () => {
    // item_1 alcanza, item_2 no.
    calcularDisponibilidad
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(1);
    Reserva.create.mockResolvedValue([{ _id: 'r1' }]);

    await expect(aprobarConReserva(params())).rejects.toBeInstanceOf(
      ConflictoStockError
    );
    // Falló el gate: no debe crearse la reserva.
    expect(Reserva.create).not.toHaveBeenCalled();
  });
});
