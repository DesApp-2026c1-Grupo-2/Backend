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

// Historial de stock: se prueba aparte; aquí lo mockeamos para no depender de
// Lote.aggregate y para verificar la emisión de movimientos.
vi.mock('../../../services/movimientoStock.service.js', () => ({
  registrarMovimiento: vi.fn().mockResolvedValue({}),
  stockFisicoItem: vi.fn().mockResolvedValue(100),
}));

import Lote from '../../../models/lote.model.js';
import { registrarMovimiento, stockFisicoItem } from '../../../services/movimientoStock.service.js';
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
    it('debe crear un nuevo lote (201) y registrar un movimiento COMPRA', async () => {
      const req = mockReq({ body: { itemId: '1', cantidadDisponible: 10, ubicacion: 'A1' } });
      const res = mockRes();
      vi.spyOn(Lote.prototype, 'save').mockResolvedValueOnce({
        _id: 'L1', itemId: '1', cantidadDisponible: 10, estado: 'disponible'
      });

      await createLote(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      expect(registrarMovimiento).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: '1',
          tipoMovimiento: 'COMPRA',
          cantidad: 10,
          cantidadNueva: 100,
          cantidadAnterior: 90,
        })
      );
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
    it('debe actualizar el lote exitosamente (200) y registrar AJUSTE_MANUAL', async () => {
      const req = mockReq({ params: { id: 'L1' }, body: { cantidadDisponible: 50 } });
      const res = mockRes();
      Lote.findOne.mockReturnValue(createQueryMock({ _id: 'L1', itemId: 'i1', estado: 'disponible', cantidadDisponible: 10 }));
      Lote.findOneAndUpdate.mockReturnValue(createQueryMock({ _id: 'L1', itemId: 'i1', estado: 'disponible', cantidadDisponible: 50 }));
      // Agregado antes=100, después=140 ⇒ delta +40.
      stockFisicoItem.mockResolvedValueOnce(100).mockResolvedValueOnce(140);

      await updateLote(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(registrarMovimiento).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoMovimiento: 'AJUSTE_MANUAL',
          cantidad: 40,
          cantidadAnterior: 100,
          cantidadNueva: 140,
        })
      );
    });

    it('registra BAJA cuando el PUT descarta un lote disponible', async () => {
      const req = mockReq({ params: { id: 'L1' }, body: { estado: 'descartado' } });
      const res = mockRes();
      Lote.findOne.mockReturnValue(createQueryMock({ _id: 'L1', itemId: 'i1', estado: 'disponible', cantidadDisponible: 8 }));
      Lote.findOneAndUpdate.mockReturnValue(createQueryMock({ _id: 'L1', itemId: 'i1', estado: 'descartado', cantidadDisponible: 8 }));
      // Agregado antes=108, después=100 ⇒ delta -8 (el lote sale del agregado).
      stockFisicoItem.mockResolvedValueOnce(108).mockResolvedValueOnce(100);

      await updateLote(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(registrarMovimiento).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoMovimiento: 'BAJA',
          cantidad: -8,
          cantidadAnterior: 108,
          cantidadNueva: 100,
        })
      );
    });

    it('registra AJUSTE_MANUAL cuando el PUT reactiva un lote descartado', async () => {
      const req = mockReq({ params: { id: 'L1' }, body: { estado: 'disponible' } });
      const res = mockRes();
      Lote.findOne.mockReturnValue(createQueryMock({ _id: 'L1', itemId: 'i1', estado: 'descartado', cantidadDisponible: 8 }));
      Lote.findOneAndUpdate.mockReturnValue(createQueryMock({ _id: 'L1', itemId: 'i1', estado: 'disponible', cantidadDisponible: 8 }));
      // Agregado antes=100, después=108 ⇒ delta +8 (reingreso).
      stockFisicoItem.mockResolvedValueOnce(100).mockResolvedValueOnce(108);

      await updateLote(req, res);
      expect(registrarMovimiento).toHaveBeenCalledWith(
        expect.objectContaining({ tipoMovimiento: 'AJUSTE_MANUAL', cantidad: 8 })
      );
    });

    it('no registra movimiento si el agregado no cambió (delta 0)', async () => {
      const req = mockReq({ params: { id: 'L1' }, body: { ubicacion: 'Nuevo estante' } });
      const res = mockRes();
      Lote.findOne.mockReturnValue(createQueryMock({ _id: 'L1', itemId: 'i1', estado: 'disponible', cantidadDisponible: 10 }));
      Lote.findOneAndUpdate.mockReturnValue(createQueryMock({ _id: 'L1', itemId: 'i1', estado: 'disponible', cantidadDisponible: 10 }));
      stockFisicoItem.mockResolvedValueOnce(100).mockResolvedValueOnce(100);

      await updateLote(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(registrarMovimiento).not.toHaveBeenCalled();
    });

    it('debe devolver 404 si no encuentra el lote para actualizar', async () => {
      const req = mockReq({ params: { id: 'L1' } });
      const res = mockRes();
      Lote.findOne.mockReturnValue(createQueryMock(null));

      await updateLote(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteLote', () => {
    it('debe marcar el lote como inactivo de forma lógica (200)', async () => {
      const req = mockReq({ params: { id: 'L1' } });
      const res = mockRes();
      Lote.findOneAndUpdate.mockReturnValue(createQueryMock({
        _id: 'L1', itemId: 'i1', estado: 'disponible', cantidadDisponible: 8, activo: false
      }));

      await deleteLote(req, res);
      expect(Lote.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'L1', activo: { $ne: false } },
        { activo: false },
        { new: true }
      );
      // El remanente disponible es el egreso físico de la baja.
      expect(registrarMovimiento).toHaveBeenCalledWith(
        expect.objectContaining({ tipoMovimiento: 'BAJA', cantidad: -8 })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});