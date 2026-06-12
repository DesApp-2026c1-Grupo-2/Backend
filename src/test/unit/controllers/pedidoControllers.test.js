import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks para modelos y dependencias ANTES de las importaciones
vi.mock('../../../models/pedido.model.js');
vi.mock('../../../models/reserva.model.js');
vi.mock('../../../models/lote.model.js');
vi.mock('../../../models/item.model.js');
vi.mock('../../../models/laboratorio.model.js');
vi.mock('../../../models/equipo.model.js');
vi.mock('../../../services/pedidoConflictos.js');
vi.mock('../../../services/pedidoValidaciones.js');

import Pedido from '../../../models/pedido.model.js';
import Reserva from '../../../models/reserva.model.js';
import Lote from '../../../models/lote.model.js';
import Item from '../../../models/item.model.js';
import Laboratorio from '../../../models/laboratorio.model.js';
import Equipo from '../../../models/equipo.model.js';
import { verificarConflictos } from '../../../services/pedidoConflictos.js';
import { validarAnticipacionPedido } from '../../../services/pedidoValidaciones.js';
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
const mockReq = (overrides = {}) => ({
  params: {}, 
  body: {}, 
  usuario: { id: 'admin_1', rol: 'ADMIN' }, 
  ...overrides
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const createQueryMock = (resolvedValue) => {
  const mockInstance = resolvedValue ? {
    ...resolvedValue,
    save: vi.fn().mockResolvedValue(resolvedValue),
    populate: vi.fn().mockResolvedValue(resolvedValue),
    toObject: () => resolvedValue,
  } : null;

  const query = Promise.resolve(mockInstance);
  query.populate = vi.fn().mockReturnValue(query);
  query.sort = vi.fn().mockReturnValue(query);
  return query;
};

// =========================================
// TESTS
// =========================================
describe('pedidoControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mocks estáticos de Pedido
    Pedido.find = vi.fn();
    Pedido.findOne = vi.fn();
    Pedido.findById = vi.fn();
    Pedido.findByIdAndUpdate = vi.fn();
    
    // Mocks de constructores e instancias
    const PedidoMock = function(data) { return { ...data, save: vi.fn().mockResolvedValue(this), populate: vi.fn().mockResolvedValue(this) }; };
    Pedido.mockImplementation(PedidoMock);

    Reserva.findOneAndUpdate = vi.fn();
    const ReservaMock = function(data) { return { ...data, save: vi.fn().mockResolvedValue(this) }; };
    Reserva.mockImplementation(ReservaMock);

    // Prevención de llamadas a DB de otros modelos
    Lote.find = vi.fn().mockReturnValue(createQueryMock([]));
    Lote.findByIdAndUpdate = vi.fn().mockResolvedValue({});
    Item.findById = vi.fn().mockResolvedValue(null);
    Laboratorio.findById = vi.fn().mockReturnValue(createQueryMock(null));
    Equipo.findById = vi.fn().mockReturnValue(createQueryMock(null));

    verificarConflictos.mockResolvedValue([]);
    validarAnticipacionPedido.mockReturnValue(true);
  });

  describe('getPedidos', () => {
    it('debe filtrar los pedidos por docente si el rol es DOCENTE', async () => {
      const req = mockReq({ usuario: { id: 'docente_1', rol: 'DOCENTE' } });
      const res = mockRes();
      Pedido.find.mockReturnValue(createQueryMock([]));
      
      await getPedidos(req, res);
      
      expect(Pedido.find).toHaveBeenCalledWith({ activo: { $ne: false }, docente: 'docente_1' });
      expect(res.json).toHaveBeenCalled();
    });

    it('debe obtener todos los pedidos si el rol es ADMIN', async () => {
      const req = mockReq({ usuario: { id: 'admin_1', rol: 'ADMIN' } });
      const res = mockRes();
      Pedido.find.mockReturnValue(createQueryMock([]));

      await getPedidos(req, res);

      expect(Pedido.find).toHaveBeenCalledWith({ activo: { $ne: false } });
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getPedidoById', () => {
    it('debe devolver 404 si el pedido no se encuentra', async () => {
      const req = mockReq({ params: { id: 'p_inexistente' } });
      const res = mockRes();
      Pedido.findById.mockReturnValue(createQueryMock(null));

      await getPedidoById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Pedido no encontrado' });
    });

    it('debe devolver 403 si un docente intenta ver un pedido ajeno', async () => {
      const req = mockReq({ params: { id: 'p_1' }, usuario: { id: 'docente_1', rol: 'DOCENTE' } });
      const res = mockRes();
      const mockPedido = { _id: 'p_1', docente: { _id: { toString: () => 'docente_2_distinto' } } };
      Pedido.findById.mockReturnValue(createQueryMock(mockPedido));

      await getPedidoById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
    });

    it('debe devolver el pedido y sus conflictos si lo encuentra', async () => {
      const req = mockReq({ params: { id: 'p_1' }, usuario: { id: 'user_1', rol: 'ADMIN' } });
      const res = mockRes();
      // El controller valida doc.docente._id vs user_1
      const mockPedido = { _id: 'p_1', docente: { _id: { toString: () => 'user_1' } } };
      Pedido.findById.mockReturnValue(createQueryMock(mockPedido));
      verificarConflictos.mockResolvedValue([{ tipo: 'test', severidad: 'baja' }]);

      await getPedidoById(req, res);

      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ...mockPedido,
        conflictos: [{ tipo: 'test', severidad: 'baja' }]
      }));
    });
  });

  describe('createPedido', () => {
    it('debe crear un pedido correctamente', async () => {
      const req = mockReq({
        body: {
          fecha: '2026-06-03',
          hora: '10:00',
          materia: 'Química',
          duracionClase: 120,
          recursos: [{ recursoId: '1', tipoRecurso: 'Item', cantidad: 1 }]
        }
      });
      const res = mockRes();

      await createPedido(req, res);

      expect(Pedido).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('debe retornar 400 si falta fechaHora', async () => {
      const req = mockReq({ body: { materia: 'Física' } });
      const res = mockRes();

      await createPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'fechaHora es obligatorio' });
    });

    it('debe retornar 400 si la validación de anticipación falla', async () => {
      // Forzamos que la validación sea rechazada
      validarAnticipacionPedido.mockReturnValue(false);
      const req = mockReq({
        body: {
          fechaHora: '2026-06-10T12:00:00Z',
          materia: 'Física',
          duracionClase: 120,
          recursos: [{ recursoId: '1', tipoRecurso: 'Item', cantidad: 1 }]
        }
      });
      const res = mockRes();

      await createPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No se pueden crear pedidos con menos de 2 horas de anticipación el mismo día o en fechas pasadas' });
    });
  });

  describe('updatePedido', () => {
    it('debe retornar 400 si la nueva fecha en la actualización no cumple con la anticipación mínima', async () => {
      validarAnticipacionPedido.mockReturnValue(false);
      const req = mockReq({
        params: { id: 'p_1' },
        body: { fechaHora: '2026-06-10T12:00:00Z' }
      });
      const res = mockRes();
      const mockPedido = { _id: 'p_1', fechaHora: new Date() };
      Pedido.findById.mockResolvedValue(mockPedido);

      await updatePedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No se pueden actualizar pedidos a menos de 2 horas de anticipación el mismo día o a fechas pasadas' });
    });
  });

  describe('updateEstado', () => {
    it('debe rechazar estados inválidos devolviendo 400', async () => {
      const req = mockReq({ params: { id: '1' }, body: { estado: 'EstadoInvalido' } });
      const res = mockRes();

      await updateEstado(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Estado no válido' });
    });
  });

  describe('aprobarPedido', () => {
    it('debe retornar 400 si el pedido ya fue aceptado', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      Pedido.findById.mockResolvedValue({ estado: 'Aceptado' });

      await aprobarPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'El pedido ya fue aceptado previamente y sus recursos ya fueron descontados.' });
    });

    it('debe retornar 400 si hay conflictos graves', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      const mockPedido = { _id: 'p_1', estado: 'Pendiente' };
      Pedido.findById.mockResolvedValue(mockPedido);
      verificarConflictos.mockResolvedValue([{ severidad: 'alta', mensaje: 'No hay stock' }]);

      await aprobarPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'El pedido tiene conflictos' }));
    });

    it('debe aprobar el pedido, crear la reserva y devolver 200', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      const mockPedido = {
        _id: 'p_1',
        estado: 'Pendiente',
        recursos: [],
        duracionClase: 120,
        fechaHora: new Date(),
        save: vi.fn(),
        populate: vi.fn(),
      };
      mockPedido.save.mockResolvedValue(mockPedido);
      mockPedido.populate.mockResolvedValue(mockPedido);
      Pedido.findById.mockResolvedValue(mockPedido);
      verificarConflictos.mockResolvedValue([]); // Sin conflictos

      await aprobarPedido(req, res);

      expect(mockPedido.estado).toBe('Aceptado');
      expect(mockPedido.save).toHaveBeenCalled();
      expect(Reserva).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String),
        pedido: mockPedido,
      }));
    });
  });

  describe('finalizarPedido', () => {
    it('debe retornar 400 si el pedido no está Aceptado', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      Pedido.findById.mockResolvedValue({ estado: 'Pendiente' });

      await finalizarPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('debe finalizar el pedido y la reserva asociada', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      const mockPedido = {
        _id: 'p_1',
        estado: 'Aceptado',
        recursos: [],
        save: vi.fn(),
        populate: vi.fn(),
      };
      mockPedido.save.mockResolvedValue(mockPedido);
      mockPedido.populate.mockResolvedValue(mockPedido);
      Pedido.findById.mockResolvedValue(mockPedido);

      await finalizarPedido(req, res);

      expect(mockPedido.estado).toBe('Finalizado');
      expect(mockPedido.save).toHaveBeenCalled();
      expect(Reserva.findOneAndUpdate).toHaveBeenCalledWith({ pedidoId: 'p_1' }, { estado: 'Finalizada' });
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('borrarPedidoLogico', () => {
    it('debe marcar el pedido como inactivo', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      Pedido.findByIdAndUpdate.mockResolvedValue({ _id: 'p_1', activo: false });

      await borrarPedidoLogico(req, res);

      expect(Pedido.findByIdAndUpdate).toHaveBeenCalledWith('p_1', { activo: false }, { new: true });
      expect(res.json).toHaveBeenCalledWith({ message: 'Pedido eliminado lógicamente', pedido: { _id: 'p_1', activo: false } });
    });

    it('debe retornar 404 si el pedido no existe', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      Pedido.findByIdAndUpdate.mockResolvedValue(null);

      await borrarPedidoLogico(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});