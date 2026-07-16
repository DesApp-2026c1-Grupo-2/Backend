import { Router } from 'express';
const router = Router();

import {
  createActividad,
  getActividades,
  getActividadById,
  updateActividad,
  deleteActividad,
  getSugerencias
} from '../controllers/actividadControllers.js';

import { validarJWT, validarRol } from '../middlewares/validateJWT.js';

// Rutas de lectura — cualquier usuario autenticado
router.use(validarJWT);

/**
 * @swagger
 * /actividades:
 *   get:
 *     summary: Listar actividades (con filtro opcional por estado)
 *     tags: [Actividades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [planificada, en_proceso, finalizada]
 *         description: Filtra por estado
 *     responses:
 *       200:
 *         description: Lista de actividades
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Actividad'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', getActividades);

/**
 * @swagger
 * /actividades/{id}:
 *   get:
 *     summary: Obtener una actividad por ID
 *     tags: [Actividades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la actividad
 *     responses:
 *       200:
 *         description: Actividad encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Actividad'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Actividad no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', getActividadById);

/**
 * @swagger
 * /actividades/{id}/sugerencias:
 *   get:
 *     summary: Obtener sugerencias de recursos para una actividad
 *     description: >-
 *       Devuelve items y equipos sugeridos según el tipo de la actividad, con
 *       su disponibilidad actual (stock / estado del equipo).
 *     tags: [Actividades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la actividad
 *     responses:
 *       200:
 *         description: Sugerencias de recursos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SugerenciasActividad'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Actividad no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/sugerencias', getSugerencias);

/**
 * @swagger
 * /actividades:
 *   post:
 *     summary: Crear una nueva actividad
 *     description: Requiere rol ADMIN o PERSONAL.
 *     tags: [Actividades]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ActividadInput'
 *     responses:
 *       201:
 *         description: Actividad creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Actividad'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol ADMIN/PERSONAL
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Rutas de escritura — solo ADMIN y PERSONAL
router.post('/', validarRol('ADMIN', 'PERSONAL'), createActividad);

/**
 * @swagger
 * /actividades/{id}:
 *   put:
 *     summary: Actualizar una actividad
 *     description: Requiere rol ADMIN o PERSONAL.
 *     tags: [Actividades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la actividad
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ActividadInput'
 *     responses:
 *       200:
 *         description: Actividad actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Actividad'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol ADMIN/PERSONAL
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Actividad no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', validarRol('ADMIN', 'PERSONAL'), updateActividad);

/**
 * @swagger
 * /actividades/{id}:
 *   delete:
 *     summary: Eliminar una actividad (borrado lógico)
 *     description: No elimina el documento; marca `activo = false`. Requiere rol ADMIN o PERSONAL.
 *     tags: [Actividades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la actividad
 *     responses:
 *       200:
 *         description: Actividad marcada como eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Actividad marcada como eliminada (borrado lógico)
 *                 actividad:
 *                   $ref: '#/components/schemas/Actividad'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol ADMIN/PERSONAL
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Actividad no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', validarRol('ADMIN', 'PERSONAL'), deleteActividad);

export default router;