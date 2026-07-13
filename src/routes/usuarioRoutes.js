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

/**
 * @swagger
 * /usuarios/login:
 *   post:
 *     summary: Autenticar un usuario y obtener un JWT
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Cuenta pendiente de aprobación o suspendida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Ruta para iniciar sesión (Login)
router.post('/login', validate(loginUsuarioSchema), login);

// Ruta para verificar token
router.get('/verify', validarJWT, verify);

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Listar usuarios (paginado)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *         description: Cantidad de resultados por página
 *     responses:
 *       200:
 *         description: Lista paginada de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 42
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 50
 *                 usuarios:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Usuario'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Rutas CRUD para Usuarios
router.get('/', validarJWT, getUsuarios);

// Usuarios pendientes de aprobación (debe ir ANTES de '/:id' para que
// Express no lo tome como un id)
router.get('/pendientes', validarJWT, validarRol('ADMIN'), getUsuariosPendientes);

// Aprobar un usuario pendiente
router.patch('/:id/aprobar', validarJWT, validarRol('ADMIN'), aprobarUsuario);

/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     summary: Obtener un usuario por ID
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usuario'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', validarJWT, getUsuarioById);

// Ruta pública para registro de usuarios
router.post('/', validate(createUsuarioSchema), createUsuario);

router.put('/:id', validarJWT, validate(updateUsuarioSchema), updateUsuario);

router.delete('/:id', validarJWT, deleteUsuario);

export default router;