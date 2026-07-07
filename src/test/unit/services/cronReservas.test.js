import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../models/reserva.model.js');
vi.mock('../../../models/item.model.js');
vi.mock('../../../models/lote.model.js');
// Forzamos el camino degradado (sin transacción) para no depender de mongoose.
vi.mock('../../../services/aprobacionReserva.js', () => ({
  soportaTransacciones: vi.fn().mockResolvedValue(false),
}));
// Historial: se prueba aparte; aquí solo verificamos que el consumo lo invoque.
vi.mock('../../../services/movimientoStock.service.js', () => ({
  registrarMovimiento: vi.fn().mockResolvedValue({}),
}));

import Reserva from '../../../models/reserva.model.js';
import Item from '../../../models/item.model.js';
import Lote from '../../../models/lote.model.js';
import { registrarMovimiento } from '../../../services/movimientoStock.service.js';
import {
  ConflictoEjecucionError,
  promoverReservaAEnCurso,
  finalizarReservasVencidas,
  correrCronReservas,
} from '../../../services/cronReservas.js';

// Item.findById(id).session(session)
const mockItemConsumible = (esConsumible) => {
  Item.findById.mockReturnValue({
    session: vi.fn().mockResolvedValue({ _id: 'i1', esConsumible }),
  });
};

// Lote.find({...}).sort({...}) => (await) lotes
const mockLotes = (lotes) => {
  Lote.find.mockReturnValue({ sort: vi.fn().mockResolvedValue(lotes) });
};

// Reserva.find({...}).select('_id') => (await) docs
const mockReservaFind = (docs) => {
  Reserva.find.mockReturnValue({ select: vi.fn().mockResolvedValue(docs) });
};

describe('promoverReservaAEnCurso (§6/§7/§8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve null si otra corrida ya reclamó la reserva', async () => {
    Reserva.findOneAndUpdate.mockResolvedValue(null); // claim falló

    const resultado = await promoverReservaAEnCurso('r1');

    expect(resultado).toBeNull();
    expect(Lote.updateOne).not.toHaveBeenCalled();
  });

  it('descuenta stock FIFO de consumibles y reescribe lotesUsados', async () => {
    const reserva = {
      _id: 'r1',
      materialesReservados: [
        { itemId: 'i1', cantidadTotal: 5, lotesUsados: [] },
      ],
      save: vi.fn().mockResolvedValue(true),
    };
    Reserva.findOneAndUpdate.mockResolvedValue(reserva); // claim OK
    mockItemConsumible(true);
    mockLotes([
      { _id: 'l1', cantidadDisponible: 3 },
      { _id: 'l2', cantidadDisponible: 10 },
    ]);

    const resultado = await promoverReservaAEnCurso('r1');

    expect(resultado).toBe('En Curso');
    // El FIFO excluye lotes dados de baja lógica (activo:false), alineado con
    // stockFisicoItem: no se consumen ni cuentan en cantidadAnterior.
    expect(Lote.find).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'i1',
        estado: 'disponible',
        activo: { $ne: false },
        cantidadDisponible: { $gt: 0 },
      })
    );
    // Decremento real por lote tocado (FIFO).
    expect(Lote.updateOne).toHaveBeenCalledWith(
      { _id: 'l1' },
      { $inc: { cantidadDisponible: -3 } },
      {}
    );
    expect(Lote.updateOne).toHaveBeenCalledWith(
      { _id: 'l2' },
      { $inc: { cantidadDisponible: -2 } },
      {}
    );
    // lotesUsados se sobrescribe con lo realmente consumido (no se suma encima).
    expect(reserva.materialesReservados[0].lotesUsados).toEqual([
      { loteId: 'l1', cantidad: 3 },
      { loteId: 'l2', cantidad: 2 },
    ]);
    // Movimiento de historial: egreso físico del consumible (anterior = 3 + 10).
    expect(registrarMovimiento).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'i1',
        tipoMovimiento: 'APROBACION_RESERVA',
        cantidad: -5,
        cantidadAnterior: 13,
        cantidadNueva: 8,
        reservaId: 'r1',
      }),
      null
    );
    expect(reserva.save).toHaveBeenCalled();
  });

  it('marca Conflicto (§8) y no descuenta si el FIFO no cubre la cantidad', async () => {
    const reserva = {
      _id: 'r1',
      materialesReservados: [
        { itemId: 'i1', cantidadTotal: 5, lotesUsados: [] },
      ],
      save: vi.fn(),
    };
    Reserva.findOneAndUpdate.mockResolvedValue(reserva);
    mockItemConsumible(true);
    mockLotes([{ _id: 'l1', cantidadDisponible: 2 }]); // insuficiente

    const resultado = await promoverReservaAEnCurso('r1');

    expect(resultado).toBe('Conflicto');
    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(Reserva.updateOne).toHaveBeenCalledWith(
      { _id: 'r1' },
      { $set: { estado: 'Conflicto' } }
    );
  });

  it('los reutilizables no ejecutan consumo físico', async () => {
    const reserva = {
      _id: 'r1',
      materialesReservados: [
        { itemId: 'i1', cantidadTotal: 5, lotesUsados: [] },
      ],
      save: vi.fn().mockResolvedValue(true),
    };
    Reserva.findOneAndUpdate.mockResolvedValue(reserva);
    mockItemConsumible(false); // reutilizable

    const resultado = await promoverReservaAEnCurso('r1');

    expect(resultado).toBe('En Curso');
    expect(Lote.find).not.toHaveBeenCalled();
    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(reserva.save).toHaveBeenCalled();
  });
});

describe('ConflictoEjecucionError', () => {
  it('expone itemId, disponible y solicitado', () => {
    const err = new ConflictoEjecucionError('i1', 2, 5);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConflictoEjecucionError');
    expect(err.itemId).toBe('i1');
    expect(err.disponible).toBe(2);
    expect(err.solicitado).toBe(5);
  });
});

describe('finalizarReservasVencidas (§9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finaliza con claim atómico las reservas En Curso vencidas', async () => {
    mockReservaFind([{ _id: 'r1' }, { _id: 'r2' }]);
    Reserva.findOneAndUpdate.mockResolvedValue({ _id: 'r1' }); // claim OK

    const finalizadas = await finalizarReservasVencidas();

    expect(finalizadas).toBe(2);
    expect(Reserva.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'En Curso' }),
      { $set: { estado: 'Finalizada' } },
      { new: true }
    );
  });

  it('no cuenta reservas que ya fueron reclamadas por otra corrida', async () => {
    mockReservaFind([{ _id: 'r1' }]);
    Reserva.findOneAndUpdate.mockResolvedValue(null); // otra corrida la tomó

    const finalizadas = await finalizarReservasVencidas();

    expect(finalizadas).toBe(0);
  });
});

describe('correrCronReservas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve un resumen en cero cuando no hay nada que procesar', async () => {
    mockReservaFind([]); // ni pendientes ni vencidas

    const resumen = await correrCronReservas();

    expect(resumen).toEqual({ promovidas: 0, conflictos: 0, finalizadas: 0 });
  });
});
