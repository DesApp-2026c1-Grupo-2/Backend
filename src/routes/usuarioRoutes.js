import { Router } from 'express';
const router = Router();

import { validarJWT } from '../middlewares/validateJWT.js';
import validateSchema from '../middlewares/validateSchema.js';
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
  login
} from '../controllers/usuario.controller.js';

// Ruta para iniciar sesión (Login)
router.post('/login', validateSchema(loginUsuarioSchema), login);

// Rutas CRUD para Usuarios
router.get('/', validarJWT, getUsuarios);

router.get('/:id', validarJWT, getUsuarioById);

// Ruta pública para registro de usuarios
router.post('/', validateSchema(createUsuarioSchema), createUsuario);

router.put('/:id', validarJWT, validateSchema(updateUsuarioSchema), updateUsuario);

router.delete('/:id', validarJWT, deleteUsuario);

export default router;