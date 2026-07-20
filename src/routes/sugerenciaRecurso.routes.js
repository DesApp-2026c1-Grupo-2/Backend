import { Router } from 'express';
import { createSugerencia, getSugerencias, updateSugerencia, deleteSugerencia } from '../controllers/sugerenciaRecurso.controller.js';
import { validate } from '../middlewares/validator.middleware.js';
import { sugerenciaRecursoSchema } from '../schemas/sugerenciaRecursoSchema.js';

const router = Router();

/**
 * @swagger
 * /sugerencias:
 *   get:
 *     summary: Listar sugerencias de recursos
 *     description: Ordenadas por `orden` y fecha de creación. Sólo activas.
 *     tags: [Sugerencias de Recursos]
 *     responses:
 *       200:
 *         description: Lista de sugerencias (con item/equipo populados)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SugerenciaRecurso'
 */
router.get('/', getSugerencias);

/**
 * @swagger
 * /sugerencias:
 *   post:
 *     summary: Crear una sugerencia de recurso
 *     description: Debe referenciar un item O un equipo (exactamente uno).
 *     tags: [Sugerencias de Recursos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SugerenciaRecursoInput'
 *     responses:
 *       201:
 *         description: Sugerencia creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SugerenciaRecurso'
 *       400:
 *         description: Datos inválidos (falta itemId/equipoId o vienen ambos)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Item o equipo referenciado inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Ya existe una sugerencia para ese recurso y tipo de actividad
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', validate(sugerenciaRecursoSchema), createSugerencia);

/**
 * @swagger
 * /sugerencias/{id}:
 *   put:
 *     summary: Actualizar una sugerencia de recurso
 *     tags: [Sugerencias de Recursos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la sugerencia
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SugerenciaRecursoInput'
 *     responses:
 *       200:
 *         description: Sugerencia actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SugerenciaRecurso'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Sugerencia, item o equipo no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Ya existe una sugerencia para ese recurso y tipo de actividad
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', validate(sugerenciaRecursoSchema), updateSugerencia);

/**
 * @swagger
 * /sugerencias/{id}:
 *   delete:
 *     summary: Eliminar una sugerencia (borrado lógico)
 *     description: No elimina el documento; marca `activo = false`.
 *     tags: [Sugerencias de Recursos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la sugerencia
 *     responses:
 *       200:
 *         description: Sugerencia eliminada lógicamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Sugerencia eliminada lógicamente
 *                 sugerencia:
 *                   $ref: '#/components/schemas/SugerenciaRecurso'
 *       404:
 *         description: Sugerencia no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', deleteSugerencia);

export default router;