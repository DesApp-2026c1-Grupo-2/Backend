import { describe, it, expect, vi, beforeEach } from 'vitest';

// =========================================
// MOCKS
// =========================================

// 1. Mock de dependencias externas
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mocked_jwt_token')
  }
}));

// 2. Mock del modelo Usuario
vi.mock('../../../models/usuario.model.js', () => {
  const MockUsuario = function(data) {
    Object.assign(this, data);
  };
  // Métodos de instancia
  MockUsuario.prototype.save = vi.fn().mockImplementation(async function() { return this; });
  MockUsuario.prototype.compararPassword = vi.fn().mockResolvedValue(true);

  // Métodos estáticos
  MockUsuario.find = vi.fn();
  MockUsuario.findOne = vi.fn();
  MockUsuario.findOneAndUpdate = vi.fn();
  
  return { default: MockUsuario };
});

// 3. Mock del servicio de correo (evita envíos reales en los tests)
vi.mock('../../../services/emailService.js', () => ({
  enviarMailAprobacion: vi.fn().mockResolvedValue(true)
}));

import Usuario from '../../../models/usuario.model.js';
import jwt from 'jsonwebtoken';
import { enviarMailAprobacion } from '../../../services/emailService.js';
import {
  getUsuarios,
  getUsuariosPendientes,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  aprobarUsuario,
  login
} from '../../../controllers/usuario.controller.js';

// Helpers para simular requests y responses de Express
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
describe('Usuario Controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Limpia los contadores e implementaciones temporales de los mocks
  });

  describe('getUsuarios', () => {
    it('debe retornar la lista de usuarios activos (200)', async () => {
      const req = mockReq();
      const res = mockRes();
      const dataMock = [{ nombre: 'Juan', activo: true }, { nombre: 'Maria', activo: true }];
      
      Usuario.find.mockResolvedValue(dataMock);

      await getUsuarios(req, res);

      expect(Usuario.find).toHaveBeenCalledWith({ activo: { $ne: false } });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(dataMock);
    });

    it('debe retornar un error 500 si falla la consulta a BD', async () => {
      const req = mockReq();
      const res = mockRes();
      Usuario.find.mockRejectedValue(new Error('Error de conexión'));

      await getUsuarios(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Error al obtener los usuarios'
      }));
    });
  });

  describe('getUsuarioById', () => {
    it('debe retornar un usuario si el ID existe (200)', async () => {
      const req = mockReq({ params: { id: '123' } });
      const res = mockRes();
      const dataMock = { _id: '123', nombre: 'Juan' };

      Usuario.findOne.mockResolvedValue(dataMock);

      await getUsuarioById(req, res);

      expect(Usuario.findOne).toHaveBeenCalledWith({ _id: '123', activo: { $ne: false } });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(dataMock);
    });

    it('debe retornar 404 si el usuario no existe o está inactivo', async () => {
      const req = mockReq({ params: { id: '123' } });
      const res = mockRes();
      
      Usuario.findOne.mockResolvedValue(null);

      await getUsuarioById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Usuario no encontrado' });
    });
  });

  describe('createUsuario', () => {
    it('debe crear un usuario exitosamente (201)', async () => {
      const req = mockReq({
        body: { nombre: 'Ana', email: 'ana@test.com', password: '123' }
      });
      const res = mockRes();

      await createUsuario(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        nombre: 'Ana',
        email: 'ana@test.com'
      }));
    });

    it('debe eliminar el legajo del body si viene como string vacío antes de guardarlo', async () => {
      const req = mockReq({
        body: { nombre: 'Ana', legajo: '   ' }
      });
      const res = mockRes();

      await createUsuario(req, res);

      // El JSON de respuesta se emite con la instancia generada, verificamos que legajo no exista
      expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({
        legajo: expect.anything()
      }));
    });

    it('debe manejar errores de creación (ej. email duplicado) devolviendo 400', async () => {
      const req = mockReq({ body: { email: 'existente@test.com' } });
      const res = mockRes();

      vi.spyOn(Usuario.prototype, 'save').mockRejectedValueOnce(new Error('Duplicate key'));

      await createUsuario(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Error al crear el usuario'
      }));
    });
  });

  describe('updateUsuario', () => {
    it('debe actualizar un usuario exitosamente (200)', async () => {
      const req = mockReq({
        params: { id: '123' },
        body: { nombre: 'Carlos Modificado' }
      });
      const res = mockRes();
      const updatedMock = { _id: '123', nombre: 'Carlos Modificado' };

      Usuario.findOneAndUpdate.mockResolvedValue(updatedMock);

      await updateUsuario(req, res);

      expect(Usuario.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: '123', activo: { $ne: false } },
        expect.objectContaining({ nombre: 'Carlos Modificado' }),
        { new: true, runValidators: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedMock);
    });

    it('debe aplicar $unset al legajo si se envía vacío para actualizar', async () => {
      const req = mockReq({
        params: { id: '123' },
        body: { nombre: 'Carlos', legajo: '' }
      });
      const res = mockRes();
      
      Usuario.findOneAndUpdate.mockResolvedValue({ _id: '123' });

      await updateUsuario(req, res);

      expect(Usuario.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ $unset: { legajo: 1 } }),
        expect.anything()
      );
    });

    it('debe retornar 404 si se intenta actualizar un usuario inexistente', async () => {
      const req = mockReq({ params: { id: 'no-existe' } });
      const res = mockRes();
      
      Usuario.findOneAndUpdate.mockResolvedValue(null);

      await updateUsuario(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteUsuario', () => {
    it('debe marcar el usuario como inactivo / borrado lógico (200)', async () => {
      const req = mockReq({ params: { id: '123' } });
      const res = mockRes();
      const mockDeleted = { _id: '123', activo: false };

      Usuario.findOneAndUpdate.mockResolvedValue(mockDeleted);

      await deleteUsuario(req, res);

      expect(Usuario.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: '123', activo: { $ne: false } },
        { activo: false },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Usuario marcado como eliminado (borrado lógico)'
      }));
    });
  });

  describe('login', () => {
    it('debe iniciar sesión con éxito y retornar el token JWT (200)', async () => {
      const req = mockReq({ body: { email: 'admin@test.com', password: 'password123' } });
      const res = mockRes();
      
      const mockUser = new Usuario({ _id: '1', email: 'admin@test.com', rol: 'ADMIN', estado: 'ACTIVO' });
      Usuario.findOne.mockResolvedValue(mockUser);
      // El método compararPassword ya retorna true por defecto en el mock

      await login(req, res);

      expect(Usuario.findOne).toHaveBeenCalledWith({ email: 'admin@test.com', activo: { $ne: false } });
      expect(mockUser.compararPassword).toHaveBeenCalledWith('password123');
      expect(jwt.sign).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Login exitoso',
        token: 'mocked_jwt_token'
      }));
    });

    it('debe retornar 401 si el email no existe o el usuario está inactivo', async () => {
      const req = mockReq({ body: { email: 'inexistente@test.com', password: '123' } });
      const res = mockRes();
      
      Usuario.findOne.mockResolvedValue(null);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Credenciales inválidas' });
    });

    it('debe retornar 401 si la contraseña es incorrecta', async () => {
      const req = mockReq({ body: { email: 'admin@test.com', password: 'wrong' } });
      const res = mockRes();
      
      const mockUser = new Usuario({ _id: '1' });
      mockUser.compararPassword = vi.fn().mockResolvedValue(false); // Simulamos password incorrecto
      Usuario.findOne.mockResolvedValue(mockUser);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Credenciales inválidas' });
    });

    it('debe retornar 403 si la cuenta está pendiente de aprobación', async () => {
      const req = mockReq({ body: { email: 'nuevo@test.com', password: 'password123' } });
      const res = mockRes();

      const mockUser = new Usuario({ _id: '2', email: 'nuevo@test.com', rol: 'DOCENTE', estado: 'PENDIENTE' });
      Usuario.findOne.mockResolvedValue(mockUser); // compararPassword retorna true por defecto

      await login(req, res);

      expect(jwt.sign).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Tu cuenta está pendiente de aprobación' });
    });
  });

  describe('getUsuariosPendientes', () => {
    it('debe retornar los usuarios en estado PENDIENTE (200)', async () => {
      const req = mockReq();
      const res = mockRes();
      const dataMock = [{ nombre: 'Ana', estado: 'PENDIENTE' }];

      Usuario.find.mockResolvedValue(dataMock);

      await getUsuariosPendientes(req, res);

      expect(Usuario.find).toHaveBeenCalledWith({ estado: 'PENDIENTE', activo: { $ne: false } });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(dataMock);
    });

    it('debe retornar 500 ante un error de base de datos', async () => {
      const req = mockReq();
      const res = mockRes();

      Usuario.find.mockRejectedValue(new Error('DB caída'));

      await getUsuariosPendientes(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('aprobarUsuario', () => {
    it('debe aprobar un usuario pendiente, enviar el mail y responder 200', async () => {
      const req = mockReq({ params: { id: '10' } });
      const res = mockRes();

      const mockUser = new Usuario({ _id: '10', email: 'ana@test.com', nombre: 'Ana', apellido: 'Gómez', estado: 'PENDIENTE' });
      Usuario.findOne.mockResolvedValue(mockUser);

      await aprobarUsuario(req, res);

      expect(Usuario.findOne).toHaveBeenCalledWith({ _id: '10', activo: { $ne: false } });
      expect(mockUser.estado).toBe('ACTIVO');
      expect(mockUser.save).toHaveBeenCalled();
      expect(enviarMailAprobacion).toHaveBeenCalledWith(mockUser);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Usuario aprobado correctamente'
      }));
    });

    it('debe retornar 404 si el usuario no existe', async () => {
      const req = mockReq({ params: { id: 'inexistente' } });
      const res = mockRes();

      Usuario.findOne.mockResolvedValue(null);

      await aprobarUsuario(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(enviarMailAprobacion).not.toHaveBeenCalled();
    });

    it('debe retornar 409 si el usuario no está pendiente', async () => {
      const req = mockReq({ params: { id: '10' } });
      const res = mockRes();

      const mockUser = new Usuario({ _id: '10', estado: 'ACTIVO' });
      Usuario.findOne.mockResolvedValue(mockUser);

      await aprobarUsuario(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(mockUser.save).not.toHaveBeenCalled();
      expect(enviarMailAprobacion).not.toHaveBeenCalled();
    });

    it('debe aprobar igual aunque falle el envío del mail (best-effort)', async () => {
      const req = mockReq({ params: { id: '10' } });
      const res = mockRes();

      const mockUser = new Usuario({ _id: '10', email: 'ana@test.com', nombre: 'Ana', apellido: 'Gómez', estado: 'PENDIENTE' });
      Usuario.findOne.mockResolvedValue(mockUser);
      enviarMailAprobacion.mockRejectedValueOnce(new Error('SMTP caído'));

      await aprobarUsuario(req, res);

      expect(mockUser.estado).toBe('ACTIVO');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});