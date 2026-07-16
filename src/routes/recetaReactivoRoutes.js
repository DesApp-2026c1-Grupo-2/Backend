import { Router } from 'express';
const router = Router();

import {
  createRecetaReactivo,
  getRecetasReactivos,
  getRecetaReactivoById,
  updateRecetaReactivo,
  deleteRecetaReactivo
} from '../controllers/recetaReactivoControllers.js';

// Rutas CRUD para Recetas de Reactivos

/**
 * @swagger
 * /receta-reactivos:
 *   get:
 *     summary: Listar recetas de reactivos
 *     tags: [Recetas de Reactivos]
 *     parameters:
 *       - in: query
 *         name: reactivoId
 *         schema:
 *           type: string
 *         description: Filtra por reactivo
 *     responses:
 *       200:
 *         description: Lista de recetas (con reactivo y sustancias populados)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RecetaReactivo'
 */
router.get('/', getRecetasReactivos);

/**
 * @swagger
 * /receta-reactivos/{id}:
 *   get:
 *     summary: Obtener una receta por ID
 *     tags: [Recetas de Reactivos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la receta
 *     responses:
 *       200:
 *         description: Receta encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecetaReactivo'
 *       404:
 *         description: Receta de reactivo no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', getRecetaReactivoById);

/**
 * @swagger
 * /receta-reactivos:
 *   post:
 *     summary: Crear una receta de reactivo
 *     description: Existe una única receta por reactivo (reactivoId único).
 *     tags: [Recetas de Reactivos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecetaReactivoInput'
 *     responses:
 *       201:
 *         description: Receta creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecetaReactivo'
 *       400:
 *         description: Datos inválidos o ya existe una receta para ese reactivo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', createRecetaReactivo);

/**
 * @swagger
 * /receta-reactivos/{id}:
 *   put:
 *     summary: Actualizar una receta de reactivo
 *     tags: [Recetas de Reactivos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la receta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecetaReactivoInput'
 *     responses:
 *       200:
 *         description: Receta actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecetaReactivo'
 *       400:
 *         description: Datos inválidos o receta duplicada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Receta de reactivo no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', updateRecetaReactivo);

/**
 * @swagger
 * /receta-reactivos/{id}:
 *   delete:
 *     summary: Eliminar una receta de reactivo (borrado lógico)
 *     description: No elimina el documento; marca `activo = false`.
 *     tags: [Recetas de Reactivos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la receta
 *     responses:
 *       200:
 *         description: Receta marcada como eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Receta de reactivo marcada como eliminada (borrado lógico)
 *                 receta:
 *                   $ref: '#/components/schemas/RecetaReactivo'
 *       404:
 *         description: Receta de reactivo no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', deleteRecetaReactivo);

export default router;