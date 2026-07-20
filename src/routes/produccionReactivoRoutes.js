import { Router } from 'express';
const router = Router();

import {
  createProduccionReactivo,
  getProduccionesReactivos,
  getProduccionReactivoById,
  updateProduccionReactivo,
  deleteProduccionReactivo
} from '../controllers/produccionReactivoControllers.js';

// Rutas CRUD para Producción de Reactivos

/**
 * @swagger
 * /produccion-reactivos:
 *   get:
 *     summary: Listar registros de producción de reactivos
 *     tags: [Producción de Reactivos]
 *     parameters:
 *       - in: query
 *         name: reactivoId
 *         schema:
 *           type: string
 *         description: Filtra por reactivo
 *     responses:
 *       200:
 *         description: Lista de producciones (con reactivo y sustancias populados)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProduccionReactivo'
 */
router.get('/', getProduccionesReactivos);

/**
 * @swagger
 * /produccion-reactivos/{id}:
 *   get:
 *     summary: Obtener un registro de producción por ID
 *     tags: [Producción de Reactivos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la producción
 *     responses:
 *       200:
 *         description: Producción encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProduccionReactivo'
 *       404:
 *         description: Producción de reactivo no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', getProduccionReactivoById);

/**
 * @swagger
 * /produccion-reactivos:
 *   post:
 *     summary: Registrar una producción de reactivo
 *     tags: [Producción de Reactivos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProduccionReactivoInput'
 *     responses:
 *       201:
 *         description: Producción registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProduccionReactivo'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', createProduccionReactivo);

/**
 * @swagger
 * /produccion-reactivos/{id}:
 *   put:
 *     summary: Actualizar un registro de producción
 *     tags: [Producción de Reactivos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la producción
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProduccionReactivoInput'
 *     responses:
 *       200:
 *         description: Producción actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProduccionReactivo'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Producción de reactivo no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', updateProduccionReactivo);

/**
 * @swagger
 * /produccion-reactivos/{id}:
 *   delete:
 *     summary: Eliminar un registro de producción (borrado lógico)
 *     description: No elimina el documento; marca `activo = false`.
 *     tags: [Producción de Reactivos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la producción
 *     responses:
 *       200:
 *         description: Producción marcada como eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Producción de reactivo marcada como eliminada (borrado lógico)
 *                 produccion:
 *                   $ref: '#/components/schemas/ProduccionReactivo'
 *       404:
 *         description: Producción de reactivo no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', deleteProduccionReactivo);

export default router;