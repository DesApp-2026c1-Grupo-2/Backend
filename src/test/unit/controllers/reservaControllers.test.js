import { describe, it, expect, vi, beforeEach } from 'vitest';

const createQueryMock = (resolvedValue) => {
  const mockPromise = Promise.resolve(resolvedValue);
  mockPromise.populate = vi.fn().mockReturnValue(mockPromise);
  mockPromise.sort = vi.fn().mockReturnValue(mockPromise);
  return mockPromise;
};

// Mock del modelo de Reservas
vi.mock('../../../models/reserva.model.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    prototype: { save: vi.fn() }
  }
}));

// Mocks de dependencias para cancelar reserva (reposición de lotes y rechazo del pedido)
vi.mock('../../../models/lote.model.js', () => ({
  default: { findByIdAndUpdate: vi.fn() }
}));
vi.mock('../../../models/pedido.model.js', () => ({
  default: { findByIdAndUpdate: vi.fn() }
}));
vi.mock('../../../models/item.model.js', () => ({
  default: { findById: vi.fn() }
}));

// Historial de stock: dependencia cross-service, se mockea (como en loteControllers.test).
vi.mock('../../../services/movimientoStock.service.js', () => ({
  registrarMovimiento: vi.fn().mockResolvedValue({}),
  stockFisicoItem: vi.fn().mockResolvedValue(100),
}));

import Reserva from '../../../models/reserva.model.js';
import Lote from '../../../models/lote.model.js';
import Pedido from '../../../models/pedido.model.js';
import Item from '../../../models/item.model.js';
import { registrarMovimiento } from '../../../services/movimientoStock.service.js';

// Item.findById(...).select('esConsumible') → devuelve el item indicado
const mockItem = (esConsumible) =>
  Item.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ esConsumible }) });
import {
  getReservasActivasPorLaboratorio,
  getReservasActivas,
  cancelarReserva
} from '../../../controllers/reservaControllers.js';

const mockReq = (overrides = {}) => ({ params: {}, body: {}, query: {}, ...overrides });
const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('reservaControllers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getReservasActivasPorLaboratorio', () => {
    it('debe devolver las reservas activas (Pendientes/En Curso) vinculadas al laboratorio (200)', async () => {
      const req = mockReq({ params: { laboratorioId: 'lab_1' } });
      const res = mockRes();
      Reserva.find.mockReturnValue(createQueryMock([{ _id: 'r_1' }]));

      await getReservasActivasPorLaboratorio(req, res);

      expect(Reserva.find).toHaveBeenCalledWith({
        laboratorioId: 'lab_1',
        estado: { $in: ['Pendiente', 'En Curso'] }
      });
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getReservasActivas (Calendario Global)', () => {
    it('debe devolver reservas filtradas por el rango de fechas proporcionado en query (200)', async () => {
      const req = mockReq({ query: { startDate: '2026-06-01', endDate: '2026-06-07' } });
      const res = mockRes();
      Reserva.find.mockReturnValue(createQueryMock([]));

      await getReservasActivas(req, res);

      expect(Reserva.find).toHaveBeenCalledWith(expect.objectContaining({
        fechaHora: {
          $gte: expect.any(Date),
          $lte: expect.any(Date)
        }
      }));
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('cancelarReserva', () => {
    it('NO restaura stock al cancelar una reserva Pendiente (los lotesUsados son solo punteros), pero cancela y rechaza el pedido (200)', async () => {
      const req = mockReq({ params: { id: 'r_1' } });
      const res = mockRes();

      // Reserva Pendiente: nunca se decrementó cantidadDisponible.
      const mockReserva = {
        _id: 'r_1',
        estado: 'Pendiente',
        pedidoId: 'p_1',
        materialesReservados: [{
          itemId: 'item_1',
          lotesUsados: [{ loteId: 'lote_1', cantidad: 5 }]
        }],
        save: vi.fn().mockResolvedValue(true)
      };
      Reserva.findById.mockResolvedValue(mockReserva);

      await cancelarReserva(req, res);

      // Validación 1: NO se toca el stock (reponer inflaría el inventario)
      expect(Lote.findByIdAndUpdate).not.toHaveBeenCalled();

      // Validación 2: El modelo de la reserva cambia su estado
      expect(mockReserva.estado).toBe('Cancelada');
      expect(mockReserva.save).toHaveBeenCalled();

      // Validación 3: Se sincroniza el pedido marcándolo como Rechazado
      expect(Pedido.findByIdAndUpdate).toHaveBeenCalledWith('p_1', { estado: 'Rechazado' });

      // No hubo reposición física ⇒ no se registra ningún movimiento.
      expect(registrarMovimiento).not.toHaveBeenCalled();
    });

    it('restaura el stock de consumibles al cancelar una reserva En Curso (ya se descontó físicamente) (200)', async () => {
      const req = mockReq({ params: { id: 'r_2' } });
      const res = mockRes();

      const mockReserva = {
        _id: 'r_2',
        estado: 'En Curso',
        pedidoId: 'p_2',
        materialesReservados: [{
          itemId: 'item_1',
          lotesUsados: [{ loteId: 'lote_1', cantidad: 5 }]
        }],
        save: vi.fn().mockResolvedValue(true)
      };
      Reserva.findById.mockResolvedValue(mockReserva);
      mockItem(true); // consumible → sí se había decrementado

      await cancelarReserva(req, res);

      expect(Lote.findByIdAndUpdate).toHaveBeenCalledWith('lote_1', {
        $inc: { cantidadDisponible: 5 }
      });
      expect(mockReserva.estado).toBe('Cancelada');
      expect(Pedido.findByIdAndUpdate).toHaveBeenCalledWith('p_2', { estado: 'Rechazado' });

      // Reposición física del consumible ⇒ DEVOLUCION con delta positivo.
      expect(registrarMovimiento).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 'item_1',
          tipoMovimiento: 'DEVOLUCION',
          cantidad: 5,
          reservaId: 'r_2',
        })
      );
    });

    it('NO restaura stock de materiales reutilizables aunque la reserva esté En Curso (nunca se decrementaron) (200)', async () => {
      const req = mockReq({ params: { id: 'r_3' } });
      const res = mockRes();

      const mockReserva = {
        _id: 'r_3',
        estado: 'En Curso',
        pedidoId: 'p_3',
        materialesReservados: [{
          itemId: 'item_2',
          lotesUsados: [{ loteId: 'lote_2', cantidad: 3 }]
        }],
        save: vi.fn().mockResolvedValue(true)
      };
      Reserva.findById.mockResolvedValue(mockReserva);
      mockItem(false); // reutilizable → nunca se decrementó

      await cancelarReserva(req, res);

      expect(Lote.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(mockReserva.estado).toBe('Cancelada');
      // Reutilizable: nada se repuso ⇒ no se registra DEVOLUCION.
      expect(registrarMovimiento).not.toHaveBeenCalled();
    });
  });
});