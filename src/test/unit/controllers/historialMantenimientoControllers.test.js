import { describe, it, expect, vi, beforeEach } from 'vitest';

// =========================================
// MOCKS DE MODELOS
// =========================================
vi.mock('../../../models/equipo.model.js', () => {
  const MockEquipo = function (data) {
    Object.assign(this, data);
  };
  MockEquipo.prototype.save = vi.fn().mockResolvedValue(true);
  MockEquipo.findOne = vi.fn();
  return { default: MockEquipo };
});

vi.mock('../../../models/historialMantenimiento.model.js', () => {
  const MockHM = function (data) {
    Object.assign(this, data);
  };
  MockHM.prototype.save = vi.fn().mockResolvedValue(true);
  MockHM.create = vi.fn();
  MockHM.find = vi.fn();
  MockHM.findOne = vi.fn();
  MockHM.countDocuments = vi.fn();
  return { default: MockHM };
});

import Equipo from '../../../models/equipo.model.js';
import HistorialMantenimiento from '../../../models/historialMantenimiento.model.js';
import {
  registrarMantenimiento,
  finalizarMantenimiento,
  getHistorialMantenimiento,
} from '../../../controllers/historialMantenimientoControllers.js';

const mockReq = (overrides = {}) => ({
  params: {},
  body: {},
  query: {},
  usuario: { id: 'user-1' },
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

// Cadena de query para HistorialMantenimiento.find(...).sort().skip().limit().populate()
const createFindChain = (result) => {
  const chain = {};
  chain.sort = vi.fn().mockReturnValue(chain);
  chain.skip = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.populate = vi.fn().mockResolvedValue(result);
  return chain;
};

describe('historialMantenimientoControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =======================================
  describe('registrarMantenimiento', () => {
    it('debe registrar el mantenimiento y poner el equipo en mantenimiento (201)', async () => {
      const req = mockReq({
        params: { id: 'eq-1' },
        body: { tipo: 'preventivo', descripcion: 'Calibración' },
      });
      const res = mockRes();

      const equipo = new Equipo({ _id: 'eq-1', estado: 'disponible' });
      Equipo.findOne.mockResolvedValue(equipo);

      const mantenimientoMock = { id: 'm-1', tipo: 'preventivo' };
      HistorialMantenimiento.create.mockResolvedValue(mantenimientoMock);

      await registrarMantenimiento(req, res);

      expect(HistorialMantenimiento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          equipoId: 'eq-1',
          tipo: 'preventivo',
          descripcion: 'Calibración',
          responsableId: 'user-1',
        }),
      );
      expect(equipo.estado).toBe('mantenimiento');
      expect(equipo.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ equipo, mantenimiento: mantenimientoMock }),
      );
    });

    it('debe retornar 404 si el equipo no existe', async () => {
      const req = mockReq({ params: { id: 'eq-x' }, body: { tipo: 'preventivo' } });
      const res = mockRes();
      Equipo.findOne.mockResolvedValue(null);

      await registrarMantenimiento(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(HistorialMantenimiento.create).not.toHaveBeenCalled();
    });

    it('debe retornar 409 si el equipo ya está en mantenimiento', async () => {
      const req = mockReq({ params: { id: 'eq-1' }, body: { tipo: 'correctivo' } });
      const res = mockRes();
      Equipo.findOne.mockResolvedValue(new Equipo({ _id: 'eq-1', estado: 'mantenimiento' }));

      await registrarMantenimiento(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(HistorialMantenimiento.create).not.toHaveBeenCalled();
    });

    it('debe retornar 409 si el equipo está fuera de servicio', async () => {
      const req = mockReq({ params: { id: 'eq-1' }, body: { tipo: 'correctivo' } });
      const res = mockRes();
      Equipo.findOne.mockResolvedValue(new Equipo({ _id: 'eq-1', estado: 'fuera de servicio' }));

      await registrarMantenimiento(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(HistorialMantenimiento.create).not.toHaveBeenCalled();
    });

    it('debe retornar 400 ante un error de validación de Mongoose', async () => {
      const req = mockReq({ params: { id: 'eq-1' }, body: { tipo: 'preventivo' } });
      const res = mockRes();
      Equipo.findOne.mockResolvedValue(new Equipo({ _id: 'eq-1', estado: 'disponible' }));

      const err = new Error('Validation');
      err.name = 'ValidationError';
      HistorialMantenimiento.create.mockRejectedValueOnce(err);

      await registrarMantenimiento(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // =======================================
  describe('finalizarMantenimiento', () => {
    it('debe cerrar el mantenimiento abierto y poner el equipo en disponible (200)', async () => {
      const req = mockReq({ params: { id: 'eq-1' }, body: {} });
      const res = mockRes();

      const equipo = new Equipo({ _id: 'eq-1', estado: 'mantenimiento' });
      Equipo.findOne.mockResolvedValue(equipo);

      const mantenimiento = new HistorialMantenimiento({
        _id: 'm-1',
        fecha: new Date('2026-07-01T10:00:00.000Z'),
        fin: null,
      });
      HistorialMantenimiento.findOne.mockReturnValue({
        sort: vi.fn().mockResolvedValue(mantenimiento),
      });

      await finalizarMantenimiento(req, res);

      expect(mantenimiento.fin).toBeInstanceOf(Date);
      expect(mantenimiento.save).toHaveBeenCalled();
      expect(equipo.estado).toBe('disponible');
      expect(equipo.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ equipo, mantenimiento }),
      );
    });

    it('debe usar la fecha del body como fin cuando se provee', async () => {
      const finProvisto = '2026-07-05T12:00:00.000Z';
      const req = mockReq({ params: { id: 'eq-1' }, body: { fecha: finProvisto } });
      const res = mockRes();

      Equipo.findOne.mockResolvedValue(new Equipo({ _id: 'eq-1', estado: 'mantenimiento' }));
      const mantenimiento = new HistorialMantenimiento({
        _id: 'm-1',
        fecha: new Date('2026-07-01T10:00:00.000Z'),
        fin: null,
      });
      HistorialMantenimiento.findOne.mockReturnValue({
        sort: vi.fn().mockResolvedValue(mantenimiento),
      });

      await finalizarMantenimiento(req, res);

      expect(mantenimiento.fin).toEqual(new Date(finProvisto));
    });

    it('debe retornar 404 si el equipo no existe', async () => {
      const req = mockReq({ params: { id: 'eq-x' }, body: {} });
      const res = mockRes();
      Equipo.findOne.mockResolvedValue(null);

      await finalizarMantenimiento(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('debe retornar 409 si el equipo no está en mantenimiento', async () => {
      const req = mockReq({ params: { id: 'eq-1' }, body: {} });
      const res = mockRes();
      Equipo.findOne.mockResolvedValue(new Equipo({ _id: 'eq-1', estado: 'disponible' }));

      await finalizarMantenimiento(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(HistorialMantenimiento.findOne).not.toHaveBeenCalled();
    });

    it('debe retornar 409 si no hay un mantenimiento abierto', async () => {
      const req = mockReq({ params: { id: 'eq-1' }, body: {} });
      const res = mockRes();
      Equipo.findOne.mockResolvedValue(new Equipo({ _id: 'eq-1', estado: 'mantenimiento' }));
      HistorialMantenimiento.findOne.mockReturnValue({
        sort: vi.fn().mockResolvedValue(null),
      });

      await finalizarMantenimiento(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('debe retornar 400 si la validación al guardar falla (fin < fecha)', async () => {
      const req = mockReq({ params: { id: 'eq-1' }, body: { fecha: '2026-06-01T10:00:00.000Z' } });
      const res = mockRes();
      Equipo.findOne.mockResolvedValue(new Equipo({ _id: 'eq-1', estado: 'mantenimiento' }));

      const mantenimiento = new HistorialMantenimiento({
        _id: 'm-1',
        fecha: new Date('2026-07-01T10:00:00.000Z'),
        fin: null,
      });
      const err = new Error('Validation');
      err.name = 'ValidationError';
      vi.spyOn(mantenimiento, 'save').mockRejectedValueOnce(err);
      HistorialMantenimiento.findOne.mockReturnValue({
        sort: vi.fn().mockResolvedValue(mantenimiento),
      });

      await finalizarMantenimiento(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // =======================================
  describe('getHistorialMantenimiento', () => {
    it('debe devolver el historial paginado del equipo (200)', async () => {
      const req = mockReq({ params: { id: 'eq-1' }, query: { page: 1, limit: 10 } });
      const res = mockRes();

      const registros = [{ id: 'm-1', tipo: 'preventivo' }];
      HistorialMantenimiento.find.mockReturnValue(createFindChain(registros));
      HistorialMantenimiento.countDocuments.mockResolvedValue(1);

      await getHistorialMantenimiento(req, res);

      expect(HistorialMantenimiento.find).toHaveBeenCalledWith({ equipoId: 'eq-1' });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          registros,
          paginacion: { page: 1, limit: 10, total: 1, totalPaginas: 1 },
        }),
      );
    });

    it('debe aplicar el filtro por tipo cuando se provee', async () => {
      const req = mockReq({ params: { id: 'eq-1' }, query: { tipo: 'correctivo', page: 1, limit: 10 } });
      const res = mockRes();

      HistorialMantenimiento.find.mockReturnValue(createFindChain([]));
      HistorialMantenimiento.countDocuments.mockResolvedValue(0);

      await getHistorialMantenimiento(req, res);

      expect(HistorialMantenimiento.find).toHaveBeenCalledWith({ equipoId: 'eq-1', tipo: 'correctivo' });
    });

    it('debe retornar 400 ante un CastError de id inválido', async () => {
      const req = mockReq({ params: { id: 'no-valido' }, query: { page: 1, limit: 10 } });
      const res = mockRes();

      const err = new Error('Cast');
      err.name = 'CastError';
      HistorialMantenimiento.find.mockImplementationOnce(() => { throw err; });

      await getHistorialMantenimiento(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
