import { describe, it, expect, vi, beforeEach } from 'vitest';

// Helper Promise Mock
const createQueryMock = (resolvedValue) => {
  const mockPromise = Promise.resolve(resolvedValue);
  mockPromise.populate = vi.fn().mockReturnValue(mockPromise);
  return mockPromise;
};

// Mock Modelo Ítem
vi.mock('../../../models/item.model.js', () => {
  const MockItem = function(data) { Object.assign(this, data); };
  MockItem.prototype.save = vi.fn();
  MockItem.find = vi.fn();
  MockItem.findOne = vi.fn();
  MockItem.findOneAndUpdate = vi.fn();
  return { default: MockItem };
});

// Mock Modelo Lote (Dependencia del controlador de ítems)
vi.mock('../../../models/lote.model.js', () => {
  return {
    default: {
      exists: vi.fn(),
      calcularStockDisponible: vi.fn()
    }
  };
});

import Item from '../../../models/item.model.js';
import Lote from '../../../models/lote.model.js';
import {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItemLogico
} from '../../../controllers/itemControllers.js';

const mockReq = (overrides = {}) => ({ params: {}, body: {}, query: {}, ...overrides });

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('itemControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createItem', () => {
    it('debe crear un ítem (201)', async () => {
      const req = mockReq({ body: { nombre: 'Test', codigo: 'T-1', tipo: 'material' } });
      const res = mockRes();
      vi.spyOn(Item.prototype, 'save').mockResolvedValueOnce(true);

      await createItem(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('debe retornar 400 si el código de ítem ya existe (Error 11000)', async () => {
      const req = mockReq({ body: { codigo: 'DUP' } });
      const res = mockRes();
      const error = new Error('Dup');
      error.code = 11000;
      vi.spyOn(Item.prototype, 'save').mockRejectedValueOnce(error);

      await createItem(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'El código del ítem ya existe' });
    });
  });

  describe('getItems', () => {
    it('debe obtener los ítems respetando los filtros (200)', async () => {
      const req = mockReq({ query: { tipo: 'reactivo', esConsumible: 'true' } });
      const res = mockRes();
      Item.find.mockResolvedValueOnce([{ _id: '1', nombre: 'Reactivo' }]);

      await getItems(req, res);
      expect(Item.find).toHaveBeenCalledWith({
        activo: { $ne: false },
        tipo: 'reactivo',
        esConsumible: true
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getItemById', () => {
    it('debe retornar un ítem con su stock dinámico calculado (200)', async () => {
      const req = mockReq({ params: { id: 'item_1' } });
      const res = mockRes();
      
      const mockDoc = { _id: 'item_1', nombre: 'Item Test', toObject: () => ({ _id: 'item_1', nombre: 'Item Test' }) };
      Item.findOne.mockReturnValue(createQueryMock(mockDoc));
      Lote.calcularStockDisponible.mockResolvedValueOnce(150);

      await getItemById(req, res);

      expect(Item.findOne).toHaveBeenCalledWith({ _id: 'item_1', activo: { $ne: false } });
      expect(Lote.calcularStockDisponible).toHaveBeenCalledWith('item_1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ _id: 'item_1', nombre: 'Item Test', stockDisponible: 150 });
    });

    it('debe retornar 404 si el ítem no existe', async () => {
      const req = mockReq({ params: { id: 'no_existe' } });
      const res = mockRes();
      Item.findOne.mockReturnValue(createQueryMock(null));

      await getItemById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateItem', () => {
    it('debe actualizar el ítem correctamente (200)', async () => {
      const req = mockReq({ params: { id: '1' }, body: { nombre: 'Nuevo Nombre' } });
      const res = mockRes();
      Item.findOneAndUpdate.mockReturnValue(createQueryMock({ _id: '1', nombre: 'Nuevo Nombre' }));

      await updateItem(req, res);
      expect(Item.findOneAndUpdate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('debe devolver 400 por código duplicado al actualizar', async () => {
      const req = mockReq({ params: { id: '1' }, body: { codigo: 'DUP' } });
      const res = mockRes();
      const error = new Error('Dup');
      error.code = 11000;
      Item.findOneAndUpdate.mockImplementationOnce(() => { throw error; });

      await updateItem(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('debe devolver 404 si no encuentra el ítem al actualizar', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      Item.findOneAndUpdate.mockReturnValue(createQueryMock(null));

      await updateItem(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteItemLogico', () => {
    it('debe devolver 409 si existen lotes asociados (protección de integridad)', async () => {
      const req = mockReq({ params: { id: 'item_con_lotes' } });
      const res = mockRes();
      Lote.exists.mockResolvedValueOnce(true);

      await deleteItemLogico(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining("No se puede eliminar el ítem porque tiene lotes registrados")
      }));
    });

    it('debe marcar el ítem como eliminado si no hay lotes asociados (200)', async () => {
      const req = mockReq({ params: { id: 'item_limpio' } });
      const res = mockRes();
      Lote.exists.mockResolvedValueOnce(false);
      const mockEliminado = { _id: 'item_limpio', activo: false };
      Item.findOneAndUpdate.mockReturnValue(createQueryMock(mockEliminado));

      await deleteItemLogico(req, res);
      expect(Item.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'item_limpio', activo: { $ne: false } },
        { activo: false },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('debe retornar 404 si intenta borrar lógicamente un ítem inexistente', async () => {
      const req = mockReq({ params: { id: 'inexistente' } });
      const res = mockRes();
      Lote.exists.mockResolvedValueOnce(false);
      Item.findOneAndUpdate.mockReturnValue(createQueryMock(null));

      await deleteItemLogico(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});