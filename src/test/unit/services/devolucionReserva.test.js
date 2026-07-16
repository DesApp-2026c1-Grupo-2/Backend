import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mockeamos las dependencias externas del servicio, NO devolverYRegistrar (es una
// función del mismo módulo: un vi.mock parcial no interceptaría la llamada interna
// de aplicarDevolucionesFinalizacion → devolverYRegistrar). Así ejercitamos la
// mecánica real (FIFO inverso + ajuste de lotesUsados) contra Lote/movimientos mock.
vi.mock('../../../models/lote.model.js', () => ({
  default: { updateOne: vi.fn().mockResolvedValue({}) },
}));
vi.mock('../../../models/item.model.js', () => ({
  default: { findById: vi.fn(), find: vi.fn() },
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
  validarDescartesReutilizables,
  requiereConsumoReportado,
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
    expect(material.liquidado).toBe(true);
  });

  it('fallback defensivo: sin reporte asume consumo total y no devuelve nada', async () => {
    // Camino inalcanzable vía HTTP (el gate exige el reporte), pero si un caller
    // esquivara el gate, asumir "se consumió todo" no repone nada: no infla stock.
    mockItem(true); // consumible
    const material = { itemId: 'item_1', consumoEjecutado: true, lotesUsados: [{ loteId: 'lote_1', cantidad: 10 }] };
    const reserva = reservaCon(material);

    await aplicarDevolucionesFinalizacion(reserva, { consumos: [], usuarioId: 'u1' });

    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(registrarMovimiento).not.toHaveBeenCalled();
    expect(material.cantidadConsumidaReal).toBe(10);
    expect(material.lotesUsados).toEqual([{ loteId: 'lote_1', cantidad: 10 }]);
    expect(material.liquidado).toBe(true);
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
    expect(material.liquidado).toBe(true);
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
    expect(material.liquidado).toBe(true);
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
    expect(material.liquidado).toBe(true);
  });

  it('material con consumoEjecutado pero lotesUsados vacío se saltea sin registrar movimiento', async () => {
    mockItem(true);
    const material = { itemId: 'item_1', consumoEjecutado: true, lotesUsados: [] };
    const reserva = reservaCon(material);

    await aplicarDevolucionesFinalizacion(reserva, { consumos: [], usuarioId: 'u1' });

    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(registrarMovimiento).not.toHaveBeenCalled();
    expect(material.cantidadConsumidaReal).toBeUndefined();
    expect(material.liquidado).toBe(true);
  });

  it('material ya liquidado: no toca sus lotes ni registra movimiento', async () => {
    // Guarda contra la doble devolución: el cron ya saldó este material.
    const material = {
      itemId: 'item_2',
      consumoEjecutado: true,
      liquidado: true,
      lotesUsados: [{ loteId: 'lote_2', cantidad: 4 }],
    };
    const reserva = reservaCon(material);

    await aplicarDevolucionesFinalizacion(reserva, { consumos: [], usuarioId: 'u1' });

    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(registrarMovimiento).not.toHaveBeenCalled();
    expect(Item.findById).not.toHaveBeenCalled();
    expect(material.lotesUsados).toEqual([{ loteId: 'lote_2', cantidad: 4 }]);
  });

  it('reserva ya cerrada por el cron: recupera el sobrante del consumible sin re-devolver el reutilizable', async () => {
    // El escenario que motivó el cambio (ventana 3). El cron devolvió el
    // reutilizable y lo marcó; el consumible quedó pendiente de reporte.
    Item.findById.mockImplementation((id) => ({
      select: vi.fn().mockReturnValue({
        session: vi.fn().mockResolvedValue(
          id === 'item_1'
            ? { esConsumible: true, nombre: 'Agua Destilada' }
            : { esConsumible: false, nombre: 'Vaso' }
        ),
      }),
    }));

    const consumible = {
      itemId: 'item_1',
      consumoEjecutado: true,
      liquidado: false,
      lotesUsados: [{ loteId: 'lote_1', cantidad: 10 }],
    };
    const reutilizableYaDevuelto = {
      itemId: 'item_2',
      consumoEjecutado: true,
      liquidado: true,
      lotesUsados: [], // el cron lo vació al devolver el 100%
    };
    const reserva = { _id: 'r_1', laboratorioId: 'lab_1', materialesReservados: [consumible, reutilizableYaDevuelto] };

    await aplicarDevolucionesFinalizacion(reserva, {
      consumos: [{ itemId: 'item_1', cantidadConsumida: 7 }],
      usuarioId: 'u1',
    });

    // Solo vuelve el sobrante del consumible: 10 − 7 = 3.
    expect(Lote.updateOne).toHaveBeenCalledTimes(1);
    expect(Lote.updateOne).toHaveBeenCalledWith(
      { _id: 'lote_1' }, { $inc: { cantidadDisponible: 3 } }, {}
    );
    expect(registrarMovimiento).toHaveBeenCalledTimes(1);
    expect(consumible.cantidadConsumidaReal).toBe(7);
    expect(consumible.liquidado).toBe(true);
  });

  it('es idempotente: una segunda corrida no devuelve nada', async () => {
    mockItem(true); // consumible
    const material = { itemId: 'item_1', consumoEjecutado: true, lotesUsados: [{ loteId: 'lote_1', cantidad: 10 }] };
    const reserva = reservaCon(material);
    const consumos = [{ itemId: 'item_1', cantidadConsumida: 7 }];

    await aplicarDevolucionesFinalizacion(reserva, { consumos, usuarioId: 'u1' });
    expect(Lote.updateOne).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    mockItem(true);

    await aplicarDevolucionesFinalizacion(reserva, { consumos, usuarioId: 'u1' });

    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(registrarMovimiento).not.toHaveBeenCalled();
    expect(material.lotesUsados).toEqual([{ loteId: 'lote_1', cantidad: 7 }]);
  });
});

describe('requiereConsumoReportado', () => {
  const consumible = { esConsumible: true };
  const reutilizable = { esConsumible: false };

  it('exige solo al consumible con stock afuera sin liquidar (ventana 2 y 3)', () => {
    expect(requiereConsumoReportado(
      { consumoEjecutado: true, liquidado: false }, consumible
    )).toBe(true);
  });

  it('no exige si el stock todavía no salió (ventana 1)', () => {
    expect(requiereConsumoReportado(
      { consumoEjecutado: false, liquidado: false }, consumible
    )).toBe(false);
  });

  it('no exige si ya está liquidado', () => {
    expect(requiereConsumoReportado(
      { consumoEjecutado: true, liquidado: true }, consumible
    )).toBe(false);
  });

  it('no exige a los reutilizables ni cuando falta el item', () => {
    expect(requiereConsumoReportado({ consumoEjecutado: true, liquidado: false }, reutilizable)).toBe(false);
    expect(requiereConsumoReportado({ consumoEjecutado: true, liquidado: false }, null)).toBe(false);
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

  it('no exige consumo a un material ya liquidado', async () => {
    // El cron o una finalización previa ya lo saldó: no hay nada que reportar.
    const reserva = reservaCon({
      itemId: 'item_1',
      consumoEjecutado: true,
      liquidado: true,
      lotesUsados: [{ loteId: 'l', cantidad: 1000 }],
    });

    await expect(validarConsumosRequeridos(reserva, [])).resolves.toBeUndefined();
    expect(Item.findById).not.toHaveBeenCalled();
  });

  it('no acepta NaN como consumo reportado', async () => {
    mockItem(true, 'Agua Destilada');
    const reserva = reservaCon({ itemId: 'item_1', consumoEjecutado: true, lotesUsados: [{ loteId: 'l', cantidad: 1000 }] });

    await expect(
      validarConsumosRequeridos(reserva, [{ itemId: 'item_1', cantidadConsumida: NaN }])
    ).rejects.toMatchObject({ status: 400 });
  });

  it('el 400 lista los consumibles faltantes por nombre', async () => {
    mockItem(true, 'Agua Destilada');
    const reserva = reservaCon({ itemId: 'item_1', consumoEjecutado: true, lotesUsados: [{ loteId: 'l', cantidad: 1000 }] });

    await expect(validarConsumosRequeridos(reserva, [])).rejects.toThrow(/Agua Destilada/);
  });
});

describe('validarDescartesReutilizables', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // Item.find({...}).select(...).session(session) → lista de items.
  const mockFind = (items) =>
    Item.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        session: vi.fn().mockResolvedValue(items),
      }),
    });

  it('lanza 400 listando los consumibles cuando un descarte apunta a un consumible', async () => {
    mockFind([{ _id: 'item_1', esConsumible: true, nombre: 'Agua Destilada' }]);

    await expect(
      validarDescartesReutilizables([{ tipo: 'reactivo', itemId: 'item_1', cantidad: 1 }])
    ).rejects.toMatchObject({ status: 400 });
  });

  it('pasa si todos los descartes son de reutilizables', async () => {
    mockFind([{ _id: 'item_2', esConsumible: false, nombre: 'Vaso' }]);

    await expect(
      validarDescartesReutilizables([{ tipo: 'material', itemId: 'item_2', cantidad: 1 }])
    ).resolves.toBeUndefined();
  });

  it('ignora los desperfectos de equipo y no consulta items si no hay itemId', async () => {
    await expect(
      validarDescartesReutilizables([{ tipo: 'equipo', equipoId: 'eq_1' }])
    ).resolves.toBeUndefined();
    expect(Item.find).not.toHaveBeenCalled();
  });

  it('sin descartes no consulta la base', async () => {
    await expect(validarDescartesReutilizables([])).resolves.toBeUndefined();
    expect(Item.find).not.toHaveBeenCalled();
  });
});
