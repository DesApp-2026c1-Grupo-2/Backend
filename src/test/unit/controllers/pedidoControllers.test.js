import { describe, it, expect, vi, beforeEach } from 'vitest';

const createQueryMock = (resolvedValue) => {
  const mockPromise = Promise.resolve(resolvedValue);
  mockPromise.populate = vi.fn().mockReturnValue(mockPromise);
  mockPromise.sort = vi.fn().mockReturnValue(mockPromise);
  return mockPromise;
};

// Mocks para la estructura principal y dependencias
vi.mock('../../../models/pedido.model.js', () => {
  const MockPedido = function(data) { Object.assign(this, data); };
  MockPedido.prototype.save = vi.fn();
  MockPedido.prototype.populate = vi.fn().mockResolvedValue(true);
  MockPedido.find = vi.fn();
  MockPedido.findOne = vi.fn();
  MockPedido.findOneAndUpdate = vi.fn();
  return { default: MockPedido };
});

vi.mock('../../../models/lote.model.js');
vi.mock('../../../models/equipo.model.js');
vi.mock('../../../models/item.model.js');

vi.mock('../../../models/reserva.model.js', () => {
  const MockReserva = function(data) { Object.assign(this, data); };
  MockReserva.prototype.save = vi.fn();
  MockReserva.findOneAndUpdate = vi.fn();
  return { default: MockReserva };
});

vi.mock('../../../services/pedidoConflictos.js', () => ({
  verificarConflictos: vi.fn()
}));

import Pedido from '../../../models/pedido.model.js';
import { verificarConflictos } from '../../../services/pedidoConflictos.js';
import {
  getPedidos,
  getPedidoById,
  createPedido,
  aprobarPedido,
  borrarPedidoLogico
} from '../../../controllers/pedidoControllers.js';

const mockReq = (overrides = {}) => ({
  params: {}, 
  body: {}, 
  query: {}, 
  usuario: { id: 'user_1', rol: 'DOCENTE' }, 
  ...overrides
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('pedidoControllers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getPedidos', () => {
    it('debe filtrar los pedidos correctamente si el usuario tiene rol DOCENTE (200)', async () => {
      const req = mockReq();
      const res = mockRes();
      Pedido.find.mockReturnValue(createQueryMock([]));
      
      await getPedidos(req, res);
      
      expect(Pedido.find).toHaveBeenCalledWith({ activo: { $ne: false }, docente: 'user_1' });
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getPedidoById', () => {
    it('debe devolver el pedido junto con su reporte de conflictos (200)', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      
      const mockDoc = { _id: 'p_1', docente: { _id: 'user_1' }, toObject: () => ({ id: 'p_1' }) };
      Pedido.findOne.mockReturnValue(createQueryMock(mockDoc));
      verificarConflictos.mockResolvedValue([{ severidad: 'baja', mensaje: 'Advertencia menor' }]);

      await getPedidoById(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        id: 'p_1', 
        conflictos: expect.any(Array) 
      }));
    });

    it('debe retornar 403 si un docente intenta ver el pedido que no le pertenece', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      const mockDoc = { _id: 'p_1', docente: { _id: 'user_2_distinto' } }; // Propietario distinto
      Pedido.findOne.mockReturnValue(createQueryMock(mockDoc));

      await getPedidoById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
    });
  });

  describe('createPedido', () => {
    it('debe fusionar fecha y hora para crear un pedido correctamente (201)', async () => {
      const req = mockReq({ body: { fecha: '2026-06-03', hora: '10:00', materia: 'Química' } });
      const res = mockRes();
      
      const mockGuardado = new Pedido(req.body);
      vi.spyOn(Pedido.prototype, 'save').mockResolvedValueOnce(mockGuardado);

      await createPedido(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockGuardado);
    });

    it('debe retornar error 400 si faltan fecha u hora y tampoco se provee fechaHora unificada', async () => {
      const req = mockReq({ body: { materia: 'Física' } }); // Sin hora ni fecha
      const res = mockRes();

      await createPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'fechaHora es obligatorio' });
    });
  });

  describe('aprobarPedido', () => {
    it('debe retornar 400 si el pedido presenta conflictos graves de stock o laboratorio', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      
      Pedido.findOne.mockResolvedValue({ _id: 'p_1', estado: 'En Revisión', activo: true });
      // Simulamos que el servicio detector de conflictos encontró un problema grave
      verificarConflictos.mockResolvedValue([{ severidad: 'alta', mensaje: 'Falta Reactivo' }]);

      await aprobarPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'El pedido tiene conflictos' }));
    });
  });

  describe('borrarPedidoLogico', () => {
    it('debe ocultar lógicamente el pedido de las visualizaciones (200)', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      Pedido.findOneAndUpdate.mockResolvedValue({ _id: 'p_1', activo: false });
      await borrarPedidoLogico(req, res);
      expect(Pedido.findOneAndUpdate).toHaveBeenCalled();
    });
  });
});