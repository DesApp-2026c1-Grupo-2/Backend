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
    findOneAndUpdate: vi.fn(),
    exists: vi.fn(),
    prototype: { save: vi.fn() }
  }
}));

vi.mock('../../../models/pedido.model.js', () => ({
  default: { findByIdAndUpdate: vi.fn() }
}));
vi.mock('../../../models/item.model.js', () => ({
  default: { findById: vi.fn() }
}));

// Transacciones: forzamos el camino degradado (sin sesión) para no depender de mongoose.
vi.mock('../../../services/aprobacionReserva.js', () => ({
  soportaTransacciones: vi.fn().mockResolvedValue(false),
}));

// Devolución de stock: servicio compartido, se mockea para aislar el controller
// (su lógica de $inc + DEVOLUCION se prueba en devolucionReserva/movimientoStock).
vi.mock('../../../services/devolucionReserva.js', () => ({
  devolverYRegistrar: vi.fn().mockResolvedValue([]),
}));

import Reserva from '../../../models/reserva.model.js';
import Pedido from '../../../models/pedido.model.js';
import Item from '../../../models/item.model.js';
import { devolverYRegistrar } from '../../../services/devolucionReserva.js';
import {
  getReservasActivasPorLaboratorio,
  getReservasActivas,
  cancelarReserva,
  finalizarReserva
} from '../../../controllers/reservaControllers.js';

// Item.findById(id).select('esConsumible').session(session) → item indicado.
const mockItem = (esConsumible) =>
  Item.findById.mockReturnValue({
    select: vi.fn().mockReturnValue({
      session: vi.fn().mockResolvedValue({ esConsumible }),
    }),
  });

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

      // NO se repone (reponer inflaría el inventario).
      expect(devolverYRegistrar).not.toHaveBeenCalled();
      expect(mockReserva.estado).toBe('Cancelada');
      expect(mockReserva.save).toHaveBeenCalled();
      expect(Pedido.findByIdAndUpdate).toHaveBeenCalledWith('p_1', { estado: 'Rechazado' });
    });

    it('restaura el stock (consumible O reutilizable) al cancelar una reserva En Curso (ya se descontó físicamente) (200)', async () => {
      const req = mockReq({ params: { id: 'r_2' }, usuario: { id: 'u1' } });
      const res = mockRes();

      const material = { itemId: 'item_1', lotesUsados: [{ loteId: 'lote_1', cantidad: 5 }] };
      const mockReserva = {
        _id: 'r_2',
        estado: 'En Curso',
        pedidoId: 'p_2',
        laboratorioId: 'lab_1',
        materialesReservados: [material],
        save: vi.fn().mockResolvedValue(true)
      };
      Reserva.findById.mockResolvedValue(mockReserva);

      await cancelarReserva(req, res);

      // Se repone el 100% de lo que salió (todo lotesUsados = 5).
      expect(devolverYRegistrar).toHaveBeenCalledWith(
        mockReserva,
        material,
        5,
        expect.objectContaining({ usuarioId: 'u1', observacion: expect.any(String) })
      );
      expect(mockReserva.estado).toBe('Cancelada');
      expect(Pedido.findByIdAndUpdate).toHaveBeenCalledWith('p_2', { estado: 'Rechazado' });
    });

    it('también repone materiales reutilizables En Curso (ahora se decrementan al iniciar) (200)', async () => {
      const req = mockReq({ params: { id: 'r_3' } });
      const res = mockRes();

      const material = { itemId: 'item_2', lotesUsados: [{ loteId: 'lote_2', cantidad: 3 }] };
      const mockReserva = {
        _id: 'r_3',
        estado: 'En Curso',
        pedidoId: 'p_3',
        laboratorioId: 'lab_1',
        materialesReservados: [material],
        save: vi.fn().mockResolvedValue(true)
      };
      Reserva.findById.mockResolvedValue(mockReserva);

      await cancelarReserva(req, res);

      // El reutilizable En Curso también se repone (ya no se distingue por tipo).
      expect(devolverYRegistrar).toHaveBeenCalledWith(
        mockReserva,
        material,
        3,
        expect.any(Object)
      );
      expect(mockReserva.estado).toBe('Cancelada');
    });
  });

  describe('finalizarReserva', () => {
    it('devuelve el sobrante de un consumible parcialmente usado (reservado − consumido) y setea cantidadConsumidaReal (200)', async () => {
      const req = mockReq({
        params: { id: 'r_1' },
        usuario: { id: 'u1' },
        body: { consumos: [{ itemId: 'item_1', cantidadConsumida: 7 }] },
      });
      const res = mockRes();

      const material = { itemId: 'item_1', lotesUsados: [{ loteId: 'lote_1', cantidad: 10 }] };
      const reserva = {
        _id: 'r_1', estado: 'Finalizada', laboratorioId: 'lab_1',
        materialesReservados: [material],
        save: vi.fn().mockResolvedValue(true),
      };
      Reserva.findOneAndUpdate.mockResolvedValue(reserva); // claim OK
      mockItem(true); // consumible

      await finalizarReserva(req, res);

      // Claim atómico En Curso → Finalizada.
      expect(Reserva.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'r_1', estado: 'En Curso' },
        { $set: { estado: 'Finalizada' } },
        { new: true }
      );
      // Devuelve el sobrante (10 − 7 = 3).
      expect(devolverYRegistrar).toHaveBeenCalledWith(
        reserva, material, 3, expect.objectContaining({ usuarioId: 'u1' })
      );
      expect(material.cantidadConsumidaReal).toBe(7);
      expect(reserva.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ reserva }));
    });

    it('NO devuelve nada si el consumible se consumió por completo (default = todo) (200)', async () => {
      const req = mockReq({ params: { id: 'r_1' }, usuario: { id: 'u1' }, body: {} });
      const res = mockRes();

      const material = { itemId: 'item_1', lotesUsados: [{ loteId: 'lote_1', cantidad: 10 }] };
      const reserva = {
        _id: 'r_1', estado: 'Finalizada', laboratorioId: 'lab_1',
        materialesReservados: [material],
        save: vi.fn().mockResolvedValue(true),
      };
      Reserva.findOneAndUpdate.mockResolvedValue(reserva);
      mockItem(true); // consumible

      await finalizarReserva(req, res);

      expect(devolverYRegistrar).not.toHaveBeenCalled();
      expect(material.cantidadConsumidaReal).toBe(10); // consumió todo
    });

    it('devuelve el 100% de un material reutilizable al finalizar (200)', async () => {
      const req = mockReq({ params: { id: 'r_1' }, usuario: { id: 'u1' }, body: {} });
      const res = mockRes();

      const material = { itemId: 'item_2', lotesUsados: [{ loteId: 'lote_2', cantidad: 4 }] };
      const reserva = {
        _id: 'r_1', estado: 'Finalizada', laboratorioId: 'lab_1',
        materialesReservados: [material],
        save: vi.fn().mockResolvedValue(true),
      };
      Reserva.findOneAndUpdate.mockResolvedValue(reserva);
      mockItem(false); // reutilizable

      await finalizarReserva(req, res);

      expect(devolverYRegistrar).toHaveBeenCalledWith(
        reserva, material, 4, expect.any(Object)
      );
    });

    it('rechaza (400) si la reserva no está En Curso', async () => {
      const req = mockReq({ params: { id: 'r_1' }, body: {} });
      const res = mockRes();
      Reserva.findOneAndUpdate.mockResolvedValue(null); // claim no matchea
      Reserva.exists.mockResolvedValue({ _id: 'r_1' }); // pero existe

      await finalizarReserva(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(devolverYRegistrar).not.toHaveBeenCalled();
    });

    it('devuelve 404 si la reserva no existe', async () => {
      const req = mockReq({ params: { id: 'r_x' }, body: {} });
      const res = mockRes();
      Reserva.findOneAndUpdate.mockResolvedValue(null);
      Reserva.exists.mockResolvedValue(null);

      await finalizarReserva(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
