import { describe, it, expect, vi, beforeEach } from 'vitest';

const createQueryMock = (resolvedValue) => {
  const mockPromise = Promise.resolve(resolvedValue);
  mockPromise.populate = vi.fn().mockReturnValue(mockPromise);
  return mockPromise;
};

vi.mock('../../../models/lote.model.js', () => {
  const MockLote = function(data) { Object.assign(this, data); };
  MockLote.prototype.save = vi.fn();
  MockLote.find = vi.fn();
  MockLote.findOne = vi.fn();
  MockLote.findOneAndUpdate = vi.fn();
  return { default: MockLote };
});

import Lote from '../../../models/lote.model.js';
import {
  createLote,
  getLotes,
  getLoteById,
  updateLote,
  deleteLote
} from '../../../controllers/loteControllers.js';

const mockReq = (overrides = {}) => ({ params: {}, body: {}, query: {}, ...overrides });

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('loteControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createLote', () => {
    it('debe crear un nuevo lote (201)', async () => {
      const req = mockReq({ body: { itemId: '1', cantidadDisponible: 10, ubicacion: 'A1' } });
      const res = mockRes();
      vi.spyOn(Lote.prototype, 'save').mockResolvedValueOnce({ _id: 'L1', ...req.body });

      await createLote(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('debe devolver error 400 si falla la creación (ej. esquema inválido)', async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      vi.spyOn(Lote.prototype, 'save').mockRejectedValueOnce(new Error('Validation Failed'));

      await createLote(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Validation Failed' });
    });
  });

  describe('getLotes', () => {
    it('debe devolver lotes con los filtros correspondientes (200)', async () => {
      const req = mockReq({ query: { itemId: 'item_1', estado: 'disponible', ubicacion: 'Estante 1' } });
      const res = mockRes();
      const mockData = [{ _id: 'L1' }];

      Lote.find.mockReturnValue(createQueryMock(mockData));

      await getLotes(req, res);
      
      expect(Lote.find).toHaveBeenCalledWith({
        activo: { $ne: false },
        itemId: 'item_1',
        estado: 'disponible',
        ubicacion: 'Estante 1'
      });
      // Evaluamos el mock encadenado
      expect(Lote.find().populate).toHaveBeenCalledWith('itemId', 'nombre codigo tipo');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockData);
    });

    it('debe devolver 500 en caso de error interno', async () => {
      const req = mockReq();
      const res = mockRes();
      Lote.find.mockImplementationOnce(() => { throw new Error('DB Error'); });

      await getLotes(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getLoteById', () => {
    it('debe retornar el lote y popularlo (200)', async () => {
      const req = mockReq({ params: { id: 'L1' } });
      const res = mockRes();
      Lote.findOne.mockReturnValue(createQueryMock({ _id: 'L1' }));

      await getLoteById(req, res);
      expect(Lote.findOne).toHaveBeenCalledWith({ _id: 'L1', activo: { $ne: false } });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('debe retornar 404 si el lote no se encuentra', async () => {
      const req = mockReq({ params: { id: 'inexistente' } });
      const res = mockRes();
      Lote.findOne.mockReturnValue(createQueryMock(null));

      await getLoteById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateLote', () => {
    it('debe actualizar el lote exitosamente (200)', async () => {
      const req = mockReq({ params: { id: 'L1' }, body: { cantidadDisponible: 50 } });
      const res = mockRes();
      Lote.findOneAndUpdate.mockReturnValue(createQueryMock({ _id: 'L1', cantidadDisponible: 50 }));

      await updateLote(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('debe devolver 404 si no encuentra el lote para actualizar', async () => {
      const req = mockReq({ params: { id: 'L1' } });
      const res = mockRes();
      Lote.findOneAndUpdate.mockReturnValue(createQueryMock(null));

      await updateLote(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteLote', () => {
    it('debe marcar el lote como inactivo de forma lógica (200)', async () => {
      const req = mockReq({ params: { id: 'L1' } });
      const res = mockRes();
      Lote.findOneAndUpdate.mockReturnValue(createQueryMock({ _id: 'L1', activo: false }));

      await deleteLote(req, res);
      expect(Lote.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'L1', activo: { $ne: false } },
        { activo: false },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});