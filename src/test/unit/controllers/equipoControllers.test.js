import { describe, it, expect, vi, beforeEach } from 'vitest';

// =========================================
// HELPERS PARA MOCKING
// =========================================
const createQueryMock = (resolvedValue) => {
  const mockPromise = Promise.resolve(resolvedValue);
  mockPromise.populate = vi.fn().mockReturnValue(mockPromise);
  return mockPromise;
};

// 1. Mockear completamente el modelo en los controladores
vi.mock('../../../models/equipo.model.js', () => {
  const MockEquipo = function(data) {
    Object.assign(this, data);
  };
  // Asignamos el método al prototipo explícitamente para que vi.spyOn funcione
  MockEquipo.prototype.save = vi.fn().mockResolvedValue(true);

  MockEquipo.find = vi.fn();
  MockEquipo.findOne = vi.fn();
  MockEquipo.findOneAndUpdate = vi.fn();
  return { default: MockEquipo };
});

// Mock del servicio de estadísticas (el controlador solo orquesta)
vi.mock('../../../services/estadisticasEquipo.js', () => ({
  obtenerEstadisticasUso: vi.fn(),
}));

import Equipo from '../../../models/equipo.model.js';
import { obtenerEstadisticasUso } from '../../../services/estadisticasEquipo.js';
import {
  createEquipo,
  getEquipos,
  getEquipoById,
  updateEquipo,
  deleteEquipo,
  getEstadisticasUso
} from '../../../controllers/equipoControllers.js';

const mockReq = (overrides = {}) => ({
  params: {},
  body: {},
  query: {},
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

// =========================================
// SUITE DE TESTS
// =========================================
describe('equipoControllers', () => {
  beforeEach(() => {
    // Limpiar mocks antes de cada test para asegurar aislamiento
    vi.clearAllMocks();
  });

  describe('createEquipo', () => {
    it('debe crear un equipo con éxito (201)', async () => {
      const req = mockReq({ body: { nombre: 'Microscopio', codigo: 'MIC-1', tipo: 'Optico' } });
      const res = mockRes();

      await createEquipo(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      // El json se llama con la instancia simulada (que incluye req.body)
      expect(res.json).toHaveBeenCalled();
    });

    it('debe retornar error 409 si el código de equipo ya existe', async () => {
      const req = mockReq({ body: { codigo: 'EXISTENTE' } });
      const res = mockRes();

      // Simular que el save falla por llave duplicada en MongoDB
      const err = new Error("Duplicado");
      err.code = 11000;
      vi.spyOn(Equipo.prototype, 'save').mockRejectedValueOnce(err);

      await createEquipo(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: "El código de equipo ya existe." });
    });

    it('debe retornar error 400 por validación de esquema de Mongoose', async () => {
      const req = mockReq();
      const res = mockRes();

      const err = new Error("Validation Error");
      err.name = 'ValidationError';
      vi.spyOn(Equipo.prototype, 'save').mockRejectedValueOnce(err);

      await createEquipo(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('debe retornar error 500 por error interno', async () => {
      const req = mockReq();
      const res = mockRes();
      vi.spyOn(Equipo.prototype, 'save').mockRejectedValueOnce(new Error("DB Down"));

      await createEquipo(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getEquipos', () => {
    it('debe retornar una lista de equipos filtrada por estado y popular relaciones (200)', async () => {
      const req = mockReq({ query: { estado: 'disponible', edificioId: 'null' } });
      const res = mockRes();
      const dataMock = [{ id: '1', nombre: 'Eq 1' }];

      Equipo.find.mockReturnValue(createQueryMock(dataMock));

      await getEquipos(req, res);

      expect(Equipo.find).toHaveBeenCalledWith({
        activo: { $ne: false },
        estado: 'disponible',
        edificioId: null
      });
      expect(res.json).toHaveBeenCalledWith(dataMock);
    });

    it('debe retornar error 400 si hay un CastError en las queries de búsqueda', async () => {
      // Evitamos usar un string inválido en edificioId para no detonar un BSONError en new ObjectId() antes del query
      const req = mockReq({ query: {} });
      const res = mockRes();

      const err = new Error("Cast Error");
      err.name = 'CastError';
      Equipo.find.mockImplementationOnce(() => { throw err; });

      await getEquipos(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getEquipoById', () => {
    it('debe retornar un equipo especifico popular sus relaciones (200)', async () => {
      const req = mockReq({ params: { id: '507f1f77bcf86cd799439011' } });
      const res = mockRes();
      const dataMock = { _id: '507f1f77bcf86cd799439011', nombre: 'Eq 1' };

      Equipo.findOne.mockReturnValue(createQueryMock(dataMock));

      await getEquipoById(req, res);

      expect(Equipo.findOne).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(dataMock);
    });

    it('debe retornar error 404 si el equipo no existe', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      Equipo.findOne.mockReturnValue(createQueryMock(null));

      await getEquipoById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Equipo no encontrado" });
    });
  });

  describe('updateEquipo', () => {
    it('debe actualizar y guardar el equipo correctamente (200)', async () => {
      const req = mockReq({
        params: { id: '1' },
        body: { estado: 'mantenimiento' }
      });
      const res = mockRes();

      // Simulamos la instancia que devuelve findOne con capacidad para .save()
      const equipoInstancia = new Equipo({ _id: '1', estado: 'disponible' });
      Equipo.findOne.mockReturnValue(createQueryMock(equipoInstancia));

      await updateEquipo(req, res);

      expect(equipoInstancia.estado).toBe('mantenimiento');
      expect(equipoInstancia.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(equipoInstancia);
    });

    it('debe retornar 404 si intenta actualizar equipo inexistente', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      Equipo.findOne.mockReturnValue(createQueryMock(null));

      await updateEquipo(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('debe retornar 409 si el update causa conflicto de código duplicado', async () => {
      const req = mockReq({ params: { id: '1' }, body: { codigo: 'DUP' } });
      const res = mockRes();

      const equipoInstancia = new Equipo({ _id: '1' });
      const err = new Error("Duplicado");
      err.code = 11000;
      vi.spyOn(equipoInstancia, 'save').mockRejectedValueOnce(err);
      
      Equipo.findOne.mockReturnValue(createQueryMock(equipoInstancia));

      await updateEquipo(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('deleteEquipo', () => {
    it('debe hacer un borrado lógico actualizando activo a false (200)', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      const mockDeleted = { _id: '1', activo: false };

      Equipo.findOneAndUpdate.mockReturnValue(createQueryMock(mockDeleted));

      await deleteEquipo(req, res);

      expect(Equipo.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: '1', activo: { $ne: false } },
        { activo: false },
        { new: true }
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ equipo: mockDeleted }));
    });

    it('debe retornar 404 si intenta borrar equipo inexistente', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      Equipo.findOneAndUpdate.mockReturnValue(createQueryMock(null));

      await deleteEquipo(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getEstadisticasUso', () => {
    it('debe delegar en el servicio con los params validados y responder 200', async () => {
      const fecha = new Date('2026-07-05T00:00:00.000Z');
      const req = mockReq({
        query: { periodo: 'semana', fecha, page: 1, limit: 10 }
      });
      const res = mockRes();
      const resultado = {
        periodo: 'semana',
        desde: fecha,
        hasta: fecha,
        paginacion: { page: 1, limit: 10, total: 1, totalPaginas: 1 },
        equipos: [{ equipoId: 'abc', usos: 20, nombre: 'Microscopio' }]
      };
      obtenerEstadisticasUso.mockResolvedValueOnce(resultado);

      await getEstadisticasUso(req, res);

      expect(obtenerEstadisticasUso).toHaveBeenCalledWith({
        periodo: 'semana',
        fecha,
        laboratorioId: undefined,
        equipoId: undefined,
        page: 1,
        limit: 10
      });
      expect(res.json).toHaveBeenCalledWith(resultado);
    });

    it('debe retornar 500 si el servicio falla', async () => {
      const req = mockReq({ query: { periodo: 'mes', page: 1, limit: 10 } });
      const res = mockRes();
      obtenerEstadisticasUso.mockRejectedValueOnce(new Error('DB Down'));

      await getEstadisticasUso(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});