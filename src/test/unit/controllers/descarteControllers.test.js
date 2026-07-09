import { describe, it, expect, vi, beforeEach } from 'vitest';

// Query encadenable (sort/skip/limit/populate) que resuelve al await.
const createQueryMock = (resolvedValue) => {
  const mockPromise = Promise.resolve(resolvedValue);
  for (const m of ['sort', 'skip', 'limit', 'populate']) {
    mockPromise[m] = vi.fn().mockReturnValue(mockPromise);
  }
  return mockPromise;
};

vi.mock('../../../models/descarte.model.js', () => ({
  default: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

// El controller importa el service; lo mockeamos para no tocar DB al cargar el módulo.
vi.mock('../../../services/descarte.service.js', () => ({
  registrarDescarteService: vi.fn(),
  revertirDescarteService: vi.fn(),
}));

import Descarte from '../../../models/descarte.model.js';
import { getDescartes } from '../../../controllers/descarteControllers.js';

const mockReq = (overrides = {}) => ({ params: {}, query: {}, ...overrides });
const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('descarteControllers - getDescartes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aplica paginación por defecto (limit 50, skip 0) y devuelve metadata', async () => {
    const data = [{ _id: 'd1' }];
    const query = createQueryMock(data);
    Descarte.find.mockReturnValue(query);
    Descarte.countDocuments.mockResolvedValue(1);

    const req = mockReq({ query: {} });
    const res = mockRes();
    await getDescartes(req, res);

    expect(query.skip).toHaveBeenCalledWith(0);
    expect(query.limit).toHaveBeenCalledWith(50);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ total: 1, page: 1, limit: 50, descartes: data });
  });

  it('acota el limit al máximo permitido (200) y calcula el skip por página', async () => {
    const query = createQueryMock([]);
    Descarte.find.mockReturnValue(query);
    Descarte.countDocuments.mockResolvedValue(0);

    const req = mockReq({ query: { limit: '9999', page: '3' } });
    const res = mockRes();
    await getDescartes(req, res);

    expect(query.limit).toHaveBeenCalledWith(200);
    expect(query.skip).toHaveBeenCalledWith(400); // (3-1)*200
  });

  it('construye el filtro con tipo, itemId y rango desde/hasta sobre createdAt', async () => {
    const query = createQueryMock([]);
    Descarte.find.mockReturnValue(query);
    Descarte.countDocuments.mockResolvedValue(0);

    const req = mockReq({
      query: { tipo: 'reactivo', itemId: 'i1', desde: '2026-07-01', hasta: '2026-07-09' },
    });
    const res = mockRes();
    await getDescartes(req, res);

    expect(Descarte.find).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'reactivo',
        itemId: 'i1',
        createdAt: {
          $gte: new Date('2026-07-01'),
          $lte: new Date('2026-07-09'),
        },
      })
    );
  });

  it('no arma filtro de fechas cuando no se envían desde/hasta', async () => {
    const query = createQueryMock([]);
    Descarte.find.mockReturnValue(query);
    Descarte.countDocuments.mockResolvedValue(0);

    const req = mockReq({ query: { pedidoId: 'p1' } });
    const res = mockRes();
    await getDescartes(req, res);

    const filtros = Descarte.find.mock.calls[0][0];
    expect(filtros).toEqual({ pedidoId: 'p1' });
    expect(filtros).not.toHaveProperty('createdAt');
  });

  it('devuelve 500 ante error interno', async () => {
    Descarte.find.mockImplementation(() => { throw new Error('DB Error'); });
    const req = mockReq();
    const res = mockRes();
    await getDescartes(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
