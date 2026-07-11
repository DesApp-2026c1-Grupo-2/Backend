import { describe, it, expect, vi, beforeEach } from 'vitest';

// Query encadenable (sort/skip/limit/populate) que resuelve al await.
const createQueryMock = (resolvedValue) => {
  const mockPromise = Promise.resolve(resolvedValue);
  for (const m of ['sort', 'skip', 'limit', 'populate']) {
    mockPromise[m] = vi.fn().mockReturnValue(mockPromise);
  }
  return mockPromise;
};

vi.mock('../../../models/movimientoStock.model.js', () => ({
  default: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

import MovimientoStock from '../../../models/movimientoStock.model.js';
import { getMovimientos, getMovimientosPorItem } from '../../../controllers/movimientoStockControllers.js';

const mockReq = (overrides = {}) => ({ params: {}, query: {}, ...overrides });
const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('movimientoStockControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMovimientos', () => {
    it('aplica paginación por defecto (limit 50, skip 0) y devuelve metadata', async () => {
      const data = [{ _id: 'm1' }];
      const query = createQueryMock(data);
      MovimientoStock.find.mockReturnValue(query);
      MovimientoStock.countDocuments.mockResolvedValue(1);

      const req = mockReq({ query: {} });
      const res = mockRes();
      await getMovimientos(req, res);

      expect(query.skip).toHaveBeenCalledWith(0);
      expect(query.limit).toHaveBeenCalledWith(50);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ total: 1, page: 1, limit: 50, movimientos: data });
    });

    it('acota el limit al máximo permitido (200)', async () => {
      const query = createQueryMock([]);
      MovimientoStock.find.mockReturnValue(query);
      MovimientoStock.countDocuments.mockResolvedValue(0);

      const req = mockReq({ query: { limit: '9999', page: '3' } });
      const res = mockRes();
      await getMovimientos(req, res);

      expect(query.limit).toHaveBeenCalledWith(200);
      expect(query.skip).toHaveBeenCalledWith(400); // (3-1)*200
    });

    it('construye el filtro por laboratorio con $or origen/destino', async () => {
      const query = createQueryMock([]);
      MovimientoStock.find.mockReturnValue(query);
      MovimientoStock.countDocuments.mockResolvedValue(0);

      const req = mockReq({ query: { laboratorioId: 'lab1' } });
      const res = mockRes();
      await getMovimientos(req, res);

      expect(MovimientoStock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { origenLaboratorioId: 'lab1' },
            { destinoLaboratorioId: 'lab1' },
          ],
        })
      );
    });

    it('devuelve 500 ante error interno', async () => {
      MovimientoStock.find.mockImplementation(() => { throw new Error('DB Error'); });
      const req = mockReq();
      const res = mockRes();
      await getMovimientos(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getMovimientosPorItem', () => {
    it('filtra por itemId de params y pagina', async () => {
      const data = [{ _id: 'm1' }];
      const query = createQueryMock(data);
      MovimientoStock.find.mockReturnValue(query);
      MovimientoStock.countDocuments.mockResolvedValue(1);

      const req = mockReq({ params: { id: 'i1' }, query: { limit: '10' } });
      const res = mockRes();
      await getMovimientosPorItem(req, res);

      expect(MovimientoStock.find).toHaveBeenCalledWith({ itemId: 'i1' });
      expect(query.limit).toHaveBeenCalledWith(10);
      expect(res.json).toHaveBeenCalledWith({ total: 1, page: 1, limit: 10, movimientos: data });
    });
  });
});
