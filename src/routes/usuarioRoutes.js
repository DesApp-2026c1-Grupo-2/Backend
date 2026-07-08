import { Router } from 'express';
const router = Router();

import { validarJWT, validarRol } from '../middlewares/validateJWT.js';
import { validate } from '../middlewares/validator.middleware.js';
import {
  createUsuarioSchema,
  updateUsuarioSchema,
  loginUsuarioSchema
} from '../schemas/usuarioSchema.js';

import {
  getUsuarios,
  getUsuariosPendientes,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  aprobarUsuario,
  login,
  verify
} from '../controllers/usuario.controller.js';

// Ruta para iniciar sesión (Login)
router.post('/login', validate(loginUsuarioSchema), login);

// Ruta para verificar token
router.get('/verify', validarJWT, verify);

// Rutas CRUD para Usuarios
router.get('/', validarJWT, getUsuarios);

// Usuarios pendientes de aprobación (debe ir ANTES de '/:id' para que
// Express no lo tome como un id)
router.get('/pendientes', validarJWT, validarRol('ADMIN'), getUsuariosPendientes);

// Aprobar un usuario pendiente
router.patch('/:id/aprobar', validarJWT, validarRol('ADMIN'), aprobarUsuario);

router.get('/:id', validarJWT, getUsuarioById);

// Ruta pública para registro de usuarios
router.post('/', validate(createUsuarioSchema), createUsuario);

router.put('/:id', validarJWT, validate(updateUsuarioSchema), updateUsuario);

router.delete('/:id', validarJWT, deleteUsuario);

export default router;