import { Router } from 'express';
const router = Router();

import { validarJWT } from '../middlewares/validateJWT.js';
import { validate } from '../middlewares/validator.middleware.js';
import {
  createUsuarioSchema,
  updateUsuarioSchema,
  loginUsuarioSchema
} from '../schemas/usuarioSchema.js';

import {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  login,
  verify
} from '../controllers/usuario.controller.js';

// Ruta para iniciar sesión (Login)
router.post('/login', validate(loginUsuarioSchema), login);

// Ruta para verificar token
router.get('/verify', validarJWT, verify);

// Rutas CRUD para Usuarios
router.get('/', validarJWT, getUsuarios);

router.get('/:id', validarJWT, getUsuarioById);

// Ruta pública para registro de usuarios
router.post('/', validate(createUsuarioSchema), createUsuario);

router.put('/:id', validarJWT, validate(updateUsuarioSchema), updateUsuario);

router.delete('/:id', validarJWT, deleteUsuario);

export default router;