import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

/*
 * Regresión del bug documentado en
 * docs/bug-finalizar-descarte-reutilizable-no-descuenta-stock.md.
 *
 * Al finalizar un pedido con descarte de un reutilizable roto, la finalización
 * compone DOS pasos que tocan stock físico (en este orden, ver
 * services/pedido.service.js:finalizarPedidoService):
 *   1. registrarDescarteService  → descuenta lo roto del lote (esConsumible === false).
 *   2. aplicarDevolucionesFinalizacion → devuelve el reutilizable al 100%.
 *
 * El contrato del inventario es: stock físico final = devolución − descartado.
 * Como ambos servicios operan sobre el MISMO lote a través de los mismos modelos,
 * los mockeamos con un saldo de lote COMPARTIDO y mutable (shared.balance) para
 * ejercitar el neto real de las dos operaciones, no cada una por separado.
 */

const shared = vi.hoisted(() => ({ balance: {} }));

vi.mock('mongoose', async () => {
  const actual = await vi.importActual('mongoose');
  return { ...actual, default: { ...actual.default, startSession: vi.fn() } };
});

vi.mock('../../../models/descarte.model.js');
vi.mock('../../../models/pedido.model.js');
vi.mock('../../../models/equipo.model.js');
vi.mock('../../../models/reserva.model.js');
vi.mock('../../../models/lote.model.js');
vi.mock('../../../models/item.model.js');

// stockFisicoItem lee el saldo compartido; registrarMovimiento es no-op (su
// contrato se prueba en descarte.service.test.js / movimientoStock.service.test.js).
vi.mock('../../../services/movimientoStock.service.js', () => ({
  registrarMovimiento: vi.fn().mockResolvedValue({}),
  stockFisicoItem: vi.fn(async () =>
    Object.values(shared.balance).reduce((a, b) => a + b, 0)
  ),
}));

import Descarte from '../../../models/descarte.model.js';
import Pedido from '../../../models/pedido.model.js';
import Reserva from '../../../models/reserva.model.js';
import Item from '../../../models/item.model.js';
import Lote from '../../../models/lote.model.js';
import { registrarDescarteService } from '../../../services/descarte.service.js';
import { aplicarDevolucionesFinalizacion } from '../../../services/devolucionReserva.js';

// Query encadenable: soporta tanto .session() directo (descarte) como
// .select().session() (aplicarDevolucionesFinalizacion).
const chainQuery = (val) => {
  const q = {
    select: vi.fn(() => q),
    session: vi.fn().mockResolvedValue(val),
  };
  return q;
};

const usuario = { id: 'admin_1', rol: 'ADMIN' };

describe('Finalización: descarte de reutilizable + devolución (neto de stock)', () => {
  let mockSession;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSession = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      abortTransaction: vi.fn(),
      endSession: vi.fn(),
    };
    mongoose.startSession.mockResolvedValue(mockSession);

    // Constructor de Descarte con .save() resuelto.
    Descarte.mockImplementation(function (data) { return { ...data, save: vi.fn().mockResolvedValue(true) }; });
    Descarte.find = vi.fn().mockReturnValue(chainQuery([])); // sin descartes previos

    // Ítem reutilizable, compartido por ambos servicios.
    Item.findById = vi.fn().mockReturnValue(chainQuery({ _id: 'item_1', esConsumible: false }));

    Pedido.findById = vi.fn().mockReturnValue(
      chainQuery({ _id: 'pedido_1', docente: { toString: () => 'docente_1' } })
    );

    // Lote.updateOne muta el saldo compartido respetando la guarda $gte del descarte.
    Lote.updateOne = vi.fn(async (filter, update, opts) => {
      const id = filter._id;
      const inc = update.$inc.cantidadDisponible;
      const gte = filter.cantidadDisponible?.$gte;
      if (gte !== undefined && (shared.balance[id] ?? 0) < gte) {
        return { matchedCount: 0 };
      }
      shared.balance[id] = (shared.balance[id] ?? 0) + inc;
      return { matchedCount: 1 };
    });
  });

  // Reserva vista por registrarDescarteService (Reserva.findOne): necesita
  // cantidadTotal y lotesUsados para la validación y el FIFO del descarte.
  const reservaDescarte = (cantidadReservada) =>
    chainQuery({
      _id: 'reserva_1',
      laboratorioId: 'lab_1',
      materialesReservados: [
        { itemId: 'item_1', cantidadTotal: cantidadReservada, lotesUsados: [{ loteId: 'lote_1', cantidad: cantidadReservada }] },
      ],
    });

  // Reserva vista por aplicarDevolucionesFinalizacion: consumoEjecutado true
  // (el reutilizable se decrementó al iniciar) para que devuelva el 100%.
  const reservaDevolucion = (cantidadReservada) => ({
    _id: 'reserva_1',
    laboratorioId: 'lab_1',
    materialesReservados: [
      { itemId: 'item_1', consumoEjecutado: true, lotesUsados: [{ loteId: 'lote_1', cantidad: cantidadReservada }] },
    ],
  });

  it('deja el stock físico en devolución − descartado (5 reservadas, 2 rotas → 8, no 10)', async () => {
    // Ítem con 10, 5 reservadas ya decrementadas al iniciar → saldo disponible = 5.
    shared.balance = { lote_1: 5 };

    Reserva.findOne = vi.fn().mockReturnValue(reservaDescarte(5));

    // 1. Descarte de 2 rotas: 5 → 3.
    await registrarDescarteService(
      { pedidoId: 'pedido_1', tipo: 'material', itemId: 'item_1', cantidad: 2, motivo: 'Se rompió' },
      usuario
    );
    expect(shared.balance.lote_1).toBe(3);
    expect(mockSession.commitTransaction).toHaveBeenCalled();

    // 2. Devolución del reutilizable al 100% (5): 3 → 8.
    await aplicarDevolucionesFinalizacion(reservaDevolucion(5), { consumos: [], usuarioId: usuario.id });

    // Contrato del documento: 8, no 10.
    expect(shared.balance.lote_1).toBe(8);
  });

  it('sin descarte: el reutilizable vuelve al 100% (5 → 10), comportamiento intacto', async () => {
    shared.balance = { lote_1: 5 };

    await aplicarDevolucionesFinalizacion(reservaDevolucion(5), { consumos: [], usuarioId: usuario.id });

    expect(shared.balance.lote_1).toBe(10);
  });

  // Caso borde detectado al revisar el documento: cuando se reservó TODO el stock
  // disponible del lote, al finalizar cantidadDisponible = 0 y la guarda $gte del
  // descarte (descarte.service.js) impide descontar → la finalización aborta.
  it('caso borde: si se reservó todo el stock (disponible 0), el descarte falla y aborta', async () => {
    shared.balance = { lote_1: 0 }; // 5 de 5 reservadas → nada disponible al finalizar

    Reserva.findOne = vi.fn().mockReturnValue(reservaDescarte(5));

    await expect(
      registrarDescarteService(
        { pedidoId: 'pedido_1', tipo: 'material', itemId: 'item_1', cantidad: 2, motivo: 'Se rompió' },
        usuario
      )
    ).rejects.toThrow('Stock físico insuficiente en el lote para registrar el descarte.');

    expect(shared.balance.lote_1).toBe(0); // saldo intacto: no se descontó
    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.commitTransaction).not.toHaveBeenCalled();
  });
});
