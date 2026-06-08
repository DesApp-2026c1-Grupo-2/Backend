import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mocking correcto en Vitest definido antes de importar
vi.mock("../../../services/pedidoConflictos.js", () => {
  return { verificarConflictos: vi.fn() };
});

import Pedido from '../../../models/pedido.model.js';
import Lote from '../../../models/lote.model.js';
import Item from '../../../models/item.model.js';
import Reserva from '../../../models/reserva.model.js';
import Laboratorio from '../../../models/laboratorio.model.js';
import Equipo from '../../../models/equipo.model.js';
import { verificarConflictos } from '../../../services/pedidoConflictos.js';

import {
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  updateEstado,
  aprobarPedido,
  finalizarPedido,
  borrarPedidoLogico
} from '../../../controllers/pedidoControllers.js';

// =========================================
// HELPERS
// =========================================

const createQueryMock = (resolvedValue) => {
  const mockPromise = Promise.resolve(resolvedValue);
  mockPromise.populate = vi.fn().mockReturnValue(mockPromise);
  mockPromise.sort = vi.fn().mockReturnValue(mockPromise);
  return mockPromise;
};

const mockReq = (overrides = {}) => ({
  params: {},
  body: {},
  usuario: { id: 'admin123', rol: 'ADMIN' },
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

// =========================================
// TESTS
// =========================================

describe('pedidoControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Spies estáticos globales para evitar llamadas a base de datos
    vi.spyOn(Pedido, 'find').mockReturnValue(createQueryMock([]));
    vi.spyOn(Pedido, 'findOne').mockReturnValue(createQueryMock(null));
    vi.spyOn(Pedido, 'findOneAndUpdate').mockReturnValue(createQueryMock(null));
    
    // Spies sobre prototipos para atrapar instancias que hagan new Pedido() o new Reserva()
    vi.spyOn(Pedido.prototype, 'save').mockImplementation(async function () { return this; });
    vi.spyOn(Pedido.prototype, 'populate').mockImplementation(async function () { return this; });
    
    vi.spyOn(Reserva.prototype, 'save').mockImplementation(async function () { return this; });
    vi.spyOn(Reserva, 'findOneAndUpdate').mockResolvedValue({});

    vi.spyOn(Lote, 'find').mockReturnValue(createQueryMock([]));
    vi.spyOn(Lote, 'findByIdAndUpdate').mockResolvedValue({});
    
    vi.spyOn(Item, 'findById').mockResolvedValue(null);

    vi.spyOn(Laboratorio, 'findById').mockReturnValue(createQueryMock(null));
    vi.spyOn(Equipo, 'findById').mockReturnValue(createQueryMock(null));
  });

  describe('getPedidos', () => {
    it('devuelve todos los pedidos', async () => {
      const req = mockReq();
      const res = mockRes();

      const data = [{ id: '1' }];

      Pedido.find.mockReturnValue(createQueryMock(data));

      await getPedidos(req, res);

      expect(Pedido.find).toHaveBeenCalledWith({ activo: { $ne: false } });
      expect(res.json).toHaveBeenCalledWith(data);
    });

    it('filtra por docente', async () => {
      const req = mockReq({ usuario: { id: 'doc1', rol: 'DOCENTE' } });
      const res = mockRes();

      Pedido.find.mockReturnValue(createQueryMock([]));

      await getPedidos(req, res);

      expect(Pedido.find).toHaveBeenCalledWith({
        activo: { $ne: false },
        docente: 'doc1'
      });
    });
  });

  describe('getPedidoById', () => {
    it('404 si no existe', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      Pedido.findOne.mockReturnValue(createQueryMock(null));

      await getPedidoById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('retorna pedido + conflictos', async () => {
      // 2. Flujo correcto en getPedidoById
      const req = mockReq({ 
        usuario: { id: 'admin123', rol: 'ADMIN' },
        params: { id: '507f1f77bcf86cd799439011' } 
      });
      const res = mockRes();

      const pedido = {
        _id: '507f1f77bcf86cd799439011',
        // Garantizamos docente._id igual a req.usuario.id soportando validaciones
        docente: { _id: { toString: () => 'admin123' } },
        toObject: vi.fn().mockReturnValue({ id: '507f1f77bcf86cd799439011' })
      };

      Pedido.findOne.mockReturnValue(createQueryMock(pedido));
      verificarConflictos.mockResolvedValue([]);

      await getPedidoById(req, res);

      expect(verificarConflictos).toHaveBeenCalled();
      expect(verificarConflictos).toHaveBeenCalledWith(pedido);
      expect(res.json).toHaveBeenCalledWith({
        id: '507f1f77bcf86cd799439011',
        conflictos: []
      });
    });
  });

  describe('createPedido', () => {
    it('400 sin fecha', async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();

      await createPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('crea pedido', async () => {
      const req = mockReq({
        body: { fecha: '2026-01-01', hora: '10:00' }
      });
      const res = mockRes();

      await createPedido(req, res);

      expect(Pedido.prototype.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateEstado', () => {
    it('rechaza estado inválido', async () => {
      const req = mockReq({
        params: { id: '1' },
        body: { estado: 'X' }
      });
      const res = mockRes();

      await updateEstado(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('aprobarPedido', () => {
    it('rechaza si ya aceptado', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      Pedido.findOne.mockResolvedValue({ estado: 'Aceptado' });

      await aprobarPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('flujo exitoso simple', async () => {
      const req = mockReq({ params: { id: '507f1f77bcf86cd799439011' } });
      const res = mockRes();

      const pedido = {
        _id: '507f1f77bcf86cd799439011',
        estado: 'Pendiente',
        recursos: [],
        laboratorio: '507f191e810c19729de860eb',
        docente: '507f191e810c19729de860ea',
        fechaHora: new Date(),
        // 4. Mock del modelo Pedido
        save: vi.fn(),
        populate: vi.fn()
      };
      
      pedido.save.mockResolvedValue(pedido);
      pedido.populate.mockResolvedValue(pedido);

      Pedido.findOne.mockResolvedValue(pedido);
      verificarConflictos.mockResolvedValue([]);

      await aprobarPedido(req, res);

      // 5. Resultado esperado
      expect(pedido.estado).toBe("Aceptado");
      expect(pedido.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('finalizarPedido', () => {
    it('rechaza si no aceptado', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      Pedido.findOne.mockResolvedValue({ estado: 'Pendiente' });

      await finalizarPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('flujo exitoso simple', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      const pedidoMock = {
        _id: '1',
        estado: 'Aceptado',
        recursos: [],
      };
      pedidoMock.save = vi.fn().mockResolvedValue(pedidoMock);
      pedidoMock.populate = vi.fn().mockResolvedValue(pedidoMock);
      
      Pedido.findOne.mockResolvedValue(pedidoMock);

      await finalizarPedido(req, res);

      expect(pedidoMock.save).toHaveBeenCalled();
      expect(Reserva.findOneAndUpdate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('borrarPedidoLogico', () => {
    it('borrado lógico', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      Pedido.findOneAndUpdate.mockResolvedValue({});

      await borrarPedidoLogico(req, res);

      expect(Pedido.findOneAndUpdate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });
  });
});