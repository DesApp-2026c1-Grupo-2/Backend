import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mockeamos las dependencias externas del servicio, NO devolverYRegistrar (es una
// función del mismo módulo: un vi.mock parcial no interceptaría la llamada interna
// de aplicarDevolucionesFinalizacion → devolverYRegistrar). Así ejercitamos la
// mecánica real (FIFO inverso + ajuste de lotesUsados) contra Lote/movimientos mock.
vi.mock('../../../models/lote.model.js', () => ({
  default: { updateOne: vi.fn().mockResolvedValue({}) },
}));
vi.mock('../../../models/item.model.js', () => ({
  default: { findById: vi.fn() },
}));
vi.mock('../../../services/movimientoStock.service.js', () => ({
  registrarMovimiento: vi.fn().mockResolvedValue({}),
  stockFisicoItem: vi.fn().mockResolvedValue(0),
}));

import Lote from '../../../models/lote.model.js';
import Item from '../../../models/item.model.js';
import { registrarMovimiento } from '../../../services/movimientoStock.service.js';
import { aplicarDevolucionesFinalizacion } from '../../../services/devolucionReserva.js';

// Item.findById(id).select('esConsumible').session(session) → item indicado.
const mockItem = (esConsumible) =>
  Item.findById.mockReturnValue({
    select: vi.fn().mockReturnValue({
      session: vi.fn().mockResolvedValue({ esConsumible }),
    }),
  });

const reservaCon = (material) => ({
  _id: 'r_1',
  laboratorioId: 'lab_1',
  materialesReservados: [material],
});

describe('aplicarDevolucionesFinalizacion', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('consumible parcialmente usado: devuelve el sobrante (reservado − consumido) y setea cantidadConsumidaReal', async () => {
    mockItem(true); // consumible
    const material = { itemId: 'item_1', lotesUsados: [{ loteId: 'lote_1', cantidad: 10 }] };
    const reserva = reservaCon(material);

    await aplicarDevolucionesFinalizacion(reserva, {
      consumos: [{ itemId: 'item_1', cantidadConsumida: 7 }],
      usuarioId: 'u1',
    });

    // Repone 10 − 7 = 3 al lote y registra el DEVOLUCION.
    expect(Lote.updateOne).toHaveBeenCalledWith(
      { _id: 'lote_1' }, { $inc: { cantidadDisponible: 3 } }, {}
    );
    expect(registrarMovimiento).toHaveBeenCalledWith(
      expect.objectContaining({ tipoMovimiento: 'DEVOLUCION', cantidad: 3, usuarioId: 'u1' }),
      null
    );
    expect(material.cantidadConsumidaReal).toBe(7);
    // lotesUsados queda con lo realmente consumido.
    expect(material.lotesUsados).toEqual([{ loteId: 'lote_1', cantidad: 7 }]);
  });

  it('consumible sin reporte (default): consumo total, no devuelve nada', async () => {
    mockItem(true); // consumible
    const material = { itemId: 'item_1', lotesUsados: [{ loteId: 'lote_1', cantidad: 10 }] };
    const reserva = reservaCon(material);

    await aplicarDevolucionesFinalizacion(reserva, { consumos: [], usuarioId: 'u1' });

    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(registrarMovimiento).not.toHaveBeenCalled();
    expect(material.cantidadConsumidaReal).toBe(10);
    expect(material.lotesUsados).toEqual([{ loteId: 'lote_1', cantidad: 10 }]);
  });

  it('reutilizable: devuelve el 100% de lo decrementado e ignora consumos', async () => {
    mockItem(false); // reutilizable
    const material = { itemId: 'item_2', lotesUsados: [{ loteId: 'lote_2', cantidad: 4 }] };
    const reserva = reservaCon(material);

    await aplicarDevolucionesFinalizacion(reserva, {
      consumos: [{ itemId: 'item_2', cantidadConsumida: 1 }], // ignorado
      usuarioId: 'u1',
    });

    expect(Lote.updateOne).toHaveBeenCalledWith(
      { _id: 'lote_2' }, { $inc: { cantidadDisponible: 4 } }, {}
    );
    expect(registrarMovimiento).toHaveBeenCalledWith(
      expect.objectContaining({ tipoMovimiento: 'DEVOLUCION', cantidad: 4 }),
      null
    );
    // El reutilizable no reporta consumo real.
    expect(material.cantidadConsumidaReal).toBeUndefined();
    // Se devolvió todo → lotesUsados queda vacío.
    expect(material.lotesUsados).toEqual([]);
  });

  it('reparte la devolución en orden inverso al FIFO cuando hay varios lotes', async () => {
    mockItem(true); // consumible
    const material = {
      itemId: 'item_1',
      lotesUsados: [{ loteId: 'lote_1', cantidad: 5 }, { loteId: 'lote_2', cantidad: 5 }],
    };
    const reserva = reservaCon(material);

    // Consumió 3 de 10 → devuelve 7, empezando por el último lote (lote_2: 5, luego lote_1: 2).
    await aplicarDevolucionesFinalizacion(reserva, {
      consumos: [{ itemId: 'item_1', cantidadConsumida: 3 }],
      usuarioId: 'u1',
    });

    expect(Lote.updateOne).toHaveBeenNthCalledWith(1,
      { _id: 'lote_2' }, { $inc: { cantidadDisponible: 5 } }, {});
    expect(Lote.updateOne).toHaveBeenNthCalledWith(2,
      { _id: 'lote_1' }, { $inc: { cantidadDisponible: 2 } }, {});
    expect(material.cantidadConsumidaReal).toBe(3);
    // Consumido = lote_1: 5 − 2 = 3; lote_2 se devolvió entero (queda fuera).
    expect(material.lotesUsados).toEqual([{ loteId: 'lote_1', cantidad: 3 }]);
  });

  it('material sin decremento (lotesUsados vacío) se saltea sin registrar movimiento', async () => {
    mockItem(true);
    const material = { itemId: 'item_1', lotesUsados: [] };
    const reserva = reservaCon(material);

    await aplicarDevolucionesFinalizacion(reserva, { consumos: [], usuarioId: 'u1' });

    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(registrarMovimiento).not.toHaveBeenCalled();
    expect(material.cantidadConsumidaReal).toBeUndefined();
  });
});
