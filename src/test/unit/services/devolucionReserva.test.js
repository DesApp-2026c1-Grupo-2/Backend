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
import {
  aplicarDevolucionesFinalizacion,
  validarConsumosRequeridos,
} from '../../../services/devolucionReserva.js';

// Item.findById(id).select(...).session(session) → item indicado.
const mockItem = (esConsumible, nombre = 'Item') =>
  Item.findById.mockReturnValue({
    select: vi.fn().mockReturnValue({
      session: vi.fn().mockResolvedValue({ esConsumible, nombre }),
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
    const material = { itemId: 'item_1', consumoEjecutado: true, lotesUsados: [{ loteId: 'lote_1', cantidad: 10 }] };
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

  it('consumible sin reporte (default interno): consumo total, no devuelve nada', async () => {
    mockItem(true); // consumible
    const material = { itemId: 'item_1', consumoEjecutado: true, lotesUsados: [{ loteId: 'lote_1', cantidad: 10 }] };
    const reserva = reservaCon(material);

    await aplicarDevolucionesFinalizacion(reserva, { consumos: [], usuarioId: 'u1' });

    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(registrarMovimiento).not.toHaveBeenCalled();
    expect(material.cantidadConsumidaReal).toBe(10);
    expect(material.lotesUsados).toEqual([{ loteId: 'lote_1', cantidad: 10 }]);
  });

  it('reutilizable: devuelve el 100% de lo decrementado e ignora consumos', async () => {
    mockItem(false); // reutilizable
    const material = { itemId: 'item_2', consumoEjecutado: true, lotesUsados: [{ loteId: 'lote_2', cantidad: 4 }] };
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
      consumoEjecutado: true,
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

  it('consumoEjecutado=false: NO devuelve nada (evita stock fantasma) y marca consumo 0', async () => {
    // lotesUsados es un puntero FIFO de la aprobación que nunca salió del inventario.
    const material = { itemId: 'item_1', consumoEjecutado: false, lotesUsados: [{ loteId: 'lote_1', cantidad: 1000 }] };
    const reserva = reservaCon(material);

    await aplicarDevolucionesFinalizacion(reserva, {
      consumos: [{ itemId: 'item_1', cantidadConsumida: 500 }],
      usuarioId: 'u1',
    });

    // Sin descuento físico previo: no se repone stock ni se registra movimiento.
    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(registrarMovimiento).not.toHaveBeenCalled();
    expect(Item.findById).not.toHaveBeenCalled();
    expect(material.cantidadConsumidaReal).toBe(0);
  });

  it('material con consumoEjecutado pero lotesUsados vacío se saltea sin registrar movimiento', async () => {
    mockItem(true);
    const material = { itemId: 'item_1', consumoEjecutado: true, lotesUsados: [] };
    const reserva = reservaCon(material);

    await aplicarDevolucionesFinalizacion(reserva, { consumos: [], usuarioId: 'u1' });

    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(registrarMovimiento).not.toHaveBeenCalled();
    expect(material.cantidadConsumidaReal).toBeUndefined();
  });
});

describe('validarConsumosRequeridos', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('lanza 400 si falta el consumo de un consumible ya descontado', async () => {
    mockItem(true, 'Agua Destilada'); // consumible
    const reserva = reservaCon({ itemId: 'item_1', consumoEjecutado: true, lotesUsados: [{ loteId: 'l', cantidad: 1000 }] });

    await expect(validarConsumosRequeridos(reserva, [])).rejects.toMatchObject({
      status: 400,
    });
  });

  it('pasa si el consumible reporta su consumo (incluido 0)', async () => {
    mockItem(true, 'Agua Destilada');
    const reserva = reservaCon({ itemId: 'item_1', consumoEjecutado: true, lotesUsados: [{ loteId: 'l', cantidad: 1000 }] });

    await expect(
      validarConsumosRequeridos(reserva, [{ itemId: 'item_1', cantidadConsumida: 0 }])
    ).resolves.toBeUndefined();
  });

  it('no exige consumo a reutilizables', async () => {
    mockItem(false, 'Vaso'); // reutilizable
    const reserva = reservaCon({ itemId: 'item_2', consumoEjecutado: true, lotesUsados: [{ loteId: 'l', cantidad: 4 }] });

    await expect(validarConsumosRequeridos(reserva, [])).resolves.toBeUndefined();
  });

  it('no exige consumo a materiales sin descuento físico (consumoEjecutado=false)', async () => {
    const reserva = reservaCon({ itemId: 'item_1', consumoEjecutado: false, lotesUsados: [{ loteId: 'l', cantidad: 1000 }] });

    await expect(validarConsumosRequeridos(reserva, [])).resolves.toBeUndefined();
    expect(Item.findById).not.toHaveBeenCalled();
  });
});
