import { Router } from 'express';
const router = Router();

import { validarJWT } from '../middlewares/validateJWT.js';

import {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  login
} from '../controllers/usuario.controller.js';

// Ruta para iniciar sesión (Login)
router.post('/login', login);

// Rutas CRUD para Usuarios
router.get('/', validarJWT, getUsuarios);

router.get('/:id', validarJWT, getUsuarioById);

router.post('/', validarJWT, createUsuario);

router.put('/:id', validarJWT, updateUsuario);

router.delete('/:id', validarJWT, deleteUsuario);

export default router;