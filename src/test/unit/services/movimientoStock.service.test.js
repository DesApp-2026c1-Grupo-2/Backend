import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

vi.mock('../../../models/movimientoStock.model.js');
vi.mock('../../../models/lote.model.js');

import MovimientoStock from '../../../models/movimientoStock.model.js';
import Lote from '../../../models/lote.model.js';
import { registrarMovimiento, stockFisicoItem } from '../../../services/movimientoStock.service.js';

describe('stockFisicoItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('suma el cantidadDisponible de los lotes disponibles del item', async () => {
    // Lote.aggregate(pipeline) es directamente awaitable cuando no hay session.
    Lote.aggregate = vi.fn().mockResolvedValue([{ _id: 'i1', total: 42 }]);

    const total = await stockFisicoItem(new mongoose.Types.ObjectId());

    expect(total).toBe(42);
    expect(Lote.aggregate).toHaveBeenCalled();
  });

  it('devuelve 0 cuando el item no tiene lotes disponibles', async () => {
    Lote.aggregate = vi.fn().mockResolvedValue([]);

    const total = await stockFisicoItem(new mongoose.Types.ObjectId());

    expect(total).toBe(0);
  });

  it('propaga la session al aggregate cuando se pasa una', async () => {
    const sessionMock = { id: 'sess' };
    const aggMock = { session: vi.fn().mockResolvedValue([{ _id: 'i1', total: 7 }]) };
    Lote.aggregate = vi.fn().mockReturnValue(aggMock);

    const total = await stockFisicoItem(new mongoose.Types.ObjectId(), sessionMock);

    expect(total).toBe(7);
    expect(aggMock.session).toHaveBeenCalledWith(sessionMock);
  });
});

describe('registrarMovimiento', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea el movimiento sin session', async () => {
    MovimientoStock.create = vi.fn().mockResolvedValue([{ _id: 'm1' }]);
    const datos = { itemId: 'i1', tipoMovimiento: 'DESCARTE', cantidad: -2, cantidadAnterior: 10, cantidadNueva: 8 };

    const mov = await registrarMovimiento(datos);

    expect(MovimientoStock.create).toHaveBeenCalledWith([datos], {});
    expect(mov).toEqual({ _id: 'm1' });
  });

  it('pasa la session dentro de una transacción', async () => {
    MovimientoStock.create = vi.fn().mockResolvedValue([{ _id: 'm2' }]);
    const sessionMock = { id: 'sess' };
    const datos = { itemId: 'i1', tipoMovimiento: 'COMPRA', cantidad: 5, cantidadAnterior: 0, cantidadNueva: 5 };

    await registrarMovimiento(datos, sessionMock);

    expect(MovimientoStock.create).toHaveBeenCalledWith([datos], { session: sessionMock });
  });
});
