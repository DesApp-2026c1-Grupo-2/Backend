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
  aplicarDevolucionesFinalizacion: vi.fn(),
}));

import Reserva from '../../../models/reserva.model.js';
import Pedido from '../../../models/pedido.model.js';
import Item from '../../../models/item.model.js';
import { devolverYRegistrar, aplicarDevolucionesFinalizacion } from '../../../services/devolucionReserva.js';
import {
  getReservasActivasPorLaboratorio,
  getReservasActivas,
  getReservasFinalizadas,
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

  describe('getReservasFinalizadas (Calendario Histórico)', () => {
    it('filtra por estado Finalizada + rango de fechas y responde el array (200)', async () => {
      const req = mockReq({ query: { startDate: '2026-06-01', endDate: '2026-06-30' } });
      const res = mockRes();
      Reserva.find.mockReturnValue(createQueryMock([{ _id: 'r_1' }]));

      await getReservasFinalizadas(req, res);

      expect(Reserva.find).toHaveBeenCalledWith(expect.objectContaining({
        estado: 'Finalizada',
        fechaHora: { $gte: expect.any(Date), $lte: expect.any(Date) }
      }));
      expect(res.json).toHaveBeenCalledWith([{ _id: 'r_1' }]);
    });

    it('agrega laboratorioId al filtro cuando se envía por query (200)', async () => {
      const req = mockReq({ query: { startDate: '2026-06-01', endDate: '2026-06-30', laboratorioId: 'lab_1' } });
      const res = mockRes();
      Reserva.find.mockReturnValue(createQueryMock([]));

      await getReservasFinalizadas(req, res);

      expect(Reserva.find).toHaveBeenCalledWith(expect.objectContaining({
        estado: 'Finalizada',
        laboratorioId: 'lab_1'
      }));
    });

    it('responde 400 sin consultar la BD si falta el rango de fechas', async () => {
      const req = mockReq({ query: { startDate: '2026-06-01' } }); // falta endDate
      const res = mockRes();

      await getReservasFinalizadas(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(Reserva.find).not.toHaveBeenCalled();
    });

    it('responde 500 si la query falla', async () => {
      const req = mockReq({ query: { startDate: '2026-06-01', endDate: '2026-06-30' } });
      const res = mockRes();
      Reserva.find.mockImplementation(() => { throw new Error('boom'); });

      await getReservasFinalizadas(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
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
    // La lógica de cuánto devuelve cada material (reutilizable 100%, sobrante de
    // consumible, ajuste de lotesUsados) vive ahora en aplicarDevolucionesFinalizacion
    // y se prueba en devolucionReserva.test.js. Acá verificamos la DELEGACIÓN:
    // claim atómico + llamada al helper con los consumos/usuario + save + 200.
    it('hace el claim En Curso → Finalizada y delega la devolución con los consumos y el usuario (200)', async () => {
      const req = mockReq({
        params: { id: 'r_1' },
        usuario: { id: 'u1' },
        body: { consumos: [{ itemId: 'item_1', cantidadConsumida: 7 }] },
      });
      const res = mockRes();

      const reserva = {
        _id: 'r_1', estado: 'Finalizada', laboratorioId: 'lab_1',
        materialesReservados: [{ itemId: 'item_1', lotesUsados: [{ loteId: 'lote_1', cantidad: 10 }] }],
        save: vi.fn().mockResolvedValue(true),
      };
      Reserva.findOneAndUpdate.mockResolvedValue(reserva); // claim OK

      await finalizarReserva(req, res);

      // Claim atómico En Curso → Finalizada.
      expect(Reserva.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'r_1', estado: 'En Curso' },
        { $set: { estado: 'Finalizada' } },
        { new: true }
      );
      // Delega la devolución en el servicio compartido con los consumos y el usuario.
      expect(aplicarDevolucionesFinalizacion).toHaveBeenCalledWith(
        reserva,
        expect.objectContaining({
          consumos: [{ itemId: 'item_1', cantidadConsumida: 7 }],
          usuarioId: 'u1',
        })
      );
      expect(reserva.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ reserva }));
    });

    it('sin body delega con consumos vacío (default = consumo total) (200)', async () => {
      const req = mockReq({ params: { id: 'r_1' }, usuario: { id: 'u1' }, body: {} });
      const res = mockRes();

      const reserva = {
        _id: 'r_1', estado: 'Finalizada', laboratorioId: 'lab_1',
        materialesReservados: [{ itemId: 'item_1', lotesUsados: [{ loteId: 'lote_1', cantidad: 10 }] }],
        save: vi.fn().mockResolvedValue(true),
      };
      Reserva.findOneAndUpdate.mockResolvedValue(reserva);

      await finalizarReserva(req, res);

      expect(aplicarDevolucionesFinalizacion).toHaveBeenCalledWith(
        reserva,
        expect.objectContaining({ consumos: [], usuarioId: 'u1' })
      );
      expect(reserva.save).toHaveBeenCalled();
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
