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
  MockItem.countDocuments = vi.fn();
  MockItem.aggregate = vi.fn();
  return { default: MockItem };
});

// Mock Modelo Lote (Dependencia del controlador de ítems)
vi.mock('../../../models/lote.model.js', () => {
  return {
    default: {
      exists: vi.fn(),
      calcularStockDisponible: vi.fn(),
      countDocuments: vi.fn(),
      aggregate: vi.fn().mockResolvedValue([])
    }
  };
});

// Mock Modelo Equipo (usado por getEstadisticasItems para contar equipos)
vi.mock('../../../models/equipo.model.js', () => ({
  default: { countDocuments: vi.fn() },
}));

// Mock del servicio de disponibilidad (usado por getStockItem)
vi.mock('../../../services/disponibilidad.js', () => ({
  desgloseStock: vi.fn(),
}));

import Item from '../../../models/item.model.js';
import Lote from '../../../models/lote.model.js';
import Equipo from '../../../models/equipo.model.js';
import { desgloseStock } from '../../../services/disponibilidad.js';
import {
  createItem,
  getItems,
  getEstadisticasItems,
  getItemById,
  getStockItem,
  updateItem,
  deleteItemLogico
} from '../../../controllers/itemControllers.js';

// Mock del find() encadenado: .sort().skip().limit() → resuelve al array.
const createFindChainMock = (docs) => {
  const chain = {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(docs),
  };
  return chain;
};

// Doc de item con lo que consume el controller: _id, id y toObject().
const itemDoc = (id, extra = {}) => ({
  _id: id,
  id,
  toObject: () => ({ _id: id, id, ...extra }),
  ...extra,
});

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
    it('devuelve listado paginado con stockDisponible por ítem (200)', async () => {
      // Joi ya coercionó esConsumible a boolean antes del controller.
      const id1 = 'aaaaaaaaaaaaaaaaaaaaaaaa';
      const id2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
      const req = mockReq({ query: { tipo: 'reactivo', esConsumible: true } });
      const res = mockRes();
      Item.find.mockReturnValueOnce(
        createFindChainMock([
          itemDoc(id1, { nombre: 'Reactivo A' }),
          itemDoc(id2, { nombre: 'Reactivo B' }),
        ])
      );
      Item.countDocuments.mockResolvedValueOnce(2);
      // stockDisponiblePorItem agrega por itemId: solo id1 tiene stock disponible.
      Lote.aggregate.mockResolvedValueOnce([{ _id: id1, stock: 40 }]);

      await getItems(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.total).toBe(2);
      expect(payload.items).toHaveLength(2);
      expect(payload.items[0].stockDisponible).toBe(40);
      expect(payload.items[1].stockDisponible).toBe(0);
    });

    it('aplica búsqueda parcial (q) sobre nombre y código', async () => {
      const req = mockReq({ query: { q: 'aci' } });
      const res = mockRes();
      Item.find.mockReturnValueOnce(createFindChainMock([]));
      Item.countDocuments.mockResolvedValueOnce(0);
      Lote.aggregate.mockResolvedValueOnce([]);

      await getItems(req, res);

      const filtros = Item.find.mock.calls[0][0];
      expect(filtros.$or).toHaveLength(2);
      expect(filtros.$or[0].nombre).toBeInstanceOf(RegExp);
      expect(filtros.$or[1].codigo).toBeInstanceOf(RegExp);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getEstadisticasItems', () => {
    it('devuelve conteos por tipo + descartes (200)', async () => {
      const req = mockReq();
      const res = mockRes();
      Item.aggregate.mockResolvedValueOnce([
        { _id: 'material', count: 12 },
        { _id: 'reactivo', count: 8 },
      ]);
      // equipos se cuenta de la colección Equipo, no de Item.tipo === 'equipo'.
      Equipo.countDocuments.mockResolvedValueOnce(5);
      Lote.countDocuments.mockResolvedValueOnce(3);

      await getEstadisticasItems(req, res);

      expect(Equipo.countDocuments).toHaveBeenCalledWith({ activo: { $ne: false } });
      expect(Lote.countDocuments).toHaveBeenCalledWith({
        estado: 'descartado',
        activo: { $ne: false },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        equipos: 5,
        materiales: 12,
        reactivos: 8,
        sustancias: 0,
        descartes: 3,
      });
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

  describe('getStockItem (vista de stock §14)', () => {
    it('devuelve el desglose usando el día actual cuando no se pasa rango', async () => {
      const req = mockReq({ params: { id: 'item_1' } });
      const res = mockRes();
      Item.findOne.mockResolvedValueOnce({ _id: 'item_1', nombre: 'Tubo' });
      desgloseStock.mockResolvedValueOnce({
        total: 20,
        disponible: 15,
        aceptado: [{ cantidad: 5, pedidoId: 'ped_1' }],
        enUso: [],
      });

      await getStockItem(req, res);

      expect(desgloseStock).toHaveBeenCalledWith('item_1', expect.any(Date), expect.any(Date));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        itemId: 'item_1',
        total: 20,
        disponible: 15,
        aceptado: [{ cantidad: 5, pedidoId: 'ped_1' }],
        enUso: [],
      }));
    });

    it('usa el rango explícito desde/hasta cuando se proveen', async () => {
      const desde = '2026-07-01T10:00:00.000Z';
      const hasta = '2026-07-01T12:00:00.000Z';
      const req = mockReq({ params: { id: 'item_1' }, query: { desde, hasta } });
      const res = mockRes();
      Item.findOne.mockResolvedValueOnce({ _id: 'item_1' });
      desgloseStock.mockResolvedValueOnce({ total: 1, disponible: 1, aceptado: [], enUso: [] });

      await getStockItem(req, res);

      expect(desgloseStock).toHaveBeenCalledWith('item_1', new Date(desde), new Date(hasta));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('devuelve 404 si el ítem no existe', async () => {
      const req = mockReq({ params: { id: 'no_existe' } });
      const res = mockRes();
      Item.findOne.mockResolvedValueOnce(null);

      await getStockItem(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(desgloseStock).not.toHaveBeenCalled();
    });

    it('devuelve 400 si las fechas del rango son inválidas', async () => {
      const req = mockReq({ params: { id: 'item_1' }, query: { desde: 'x', hasta: 'y' } });
      const res = mockRes();
      Item.findOne.mockResolvedValueOnce({ _id: 'item_1' });

      await getStockItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(desgloseStock).not.toHaveBeenCalled();
    });

    it('devuelve 400 si desde no es anterior a hasta', async () => {
      const req = mockReq({
        params: { id: 'item_1' },
        query: { desde: '2026-07-01T12:00:00.000Z', hasta: '2026-07-01T10:00:00.000Z' },
      });
      const res = mockRes();
      Item.findOne.mockResolvedValueOnce({ _id: 'item_1' });

      await getStockItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(desgloseStock).not.toHaveBeenCalled();
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