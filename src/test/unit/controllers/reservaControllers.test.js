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

import Reserva from '../../../models/reserva.model.js';
import Lote from '../../../models/lote.model.js';
import Pedido from '../../../models/pedido.model.js';
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
    it('debe cancelar la reserva, restaurar el stock descontado y rechazar el pedido origen (200)', async () => {
      const req = mockReq({ params: { id: 'r_1' } });
      const res = mockRes();
      
      // Simulamos una reserva que gastó 5 unidades del lote_1
      const mockReserva = {
        _id: 'r_1',
        estado: 'Pendiente',
        pedidoId: 'p_1',
        materialesReservados: [{
          lotesUsados: [{ loteId: 'lote_1', cantidad: 5 }]
        }],
        save: vi.fn().mockResolvedValue(true)
      };
      Reserva.findById.mockResolvedValue(mockReserva);

      await cancelarReserva(req, res);

      // Validación 1: Se restaura el stock usando el modelo Lote
      expect(Lote.findByIdAndUpdate).toHaveBeenCalledWith('lote_1', {
        $inc: { cantidadDisponible: 5 }
      });
      
      // Validación 2: El modelo de la reserva cambia su estado
      expect(mockReserva.estado).toBe('Cancelada');
      expect(mockReserva.save).toHaveBeenCalled();
      
      // Validación 3: Se sincroniza el pedido marcándolo como Rechazado
      expect(Pedido.findByIdAndUpdate).toHaveBeenCalledWith('p_1', { estado: 'Rechazado' });
    });
  });
});