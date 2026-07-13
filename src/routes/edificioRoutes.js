import { Router } from 'express';
const router = Router()
import { crearEdificio, obtenerEdificios, obtenerEdificioPorId, actualizarEdificio,eliminarEdificioLogico} from '../controllers/edificioControllers.js';


/**
 * @swagger
 * /edificio:
 *   post:
 *     summary: Crear un nuevo edificio
 *     tags: [Edificios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EdificioInput'
 *     responses:
 *       201:
 *         description: Edificio creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Edificio'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// C: Crear un nuevo edificio
router.post('/', crearEdificio);

/**
 * @swagger
 * /edificio:
 *   get:
 *     summary: Listar todos los edificios activos
 *     tags: [Edificios]
 *     responses:
 *       200:
 *         description: Lista de edificios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Edificio'
 */
// R: Obtener todos los edificios
router.get('/', obtenerEdificios);

/**
 * @swagger
 * /edificio/{id}:
 *   get:
 *     summary: Obtener un edificio por ID
 *     tags: [Edificios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del edificio
 *     responses:
 *       200:
 *         description: Edificio encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Edificio'
 *       404:
 *         description: Edificio no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// R: Obtener un edificio por ID
router.get('/:id', obtenerEdificioPorId);

/**
 * @swagger
 * /edificio/{id}:
 *   put:
 *     summary: Actualizar un edificio
 *     tags: [Edificios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del edificio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EdificioInput'
 *     responses:
 *       200:
 *         description: Edificio actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Edificio'
 *       404:
 *         description: Edificio no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// U: Actualizar un edificio
router.put('/:id', actualizarEdificio);

/**
 * @swagger
 * /edificio/{id}:
 *   delete:
 *     summary: Eliminar un edificio (borrado lógico)
 *     description: No elimina el documento; marca `estado = false`.
 *     tags: [Edificios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del edificio
 *     responses:
 *       200:
 *         description: Edificio marcado como inactivo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Edificio'
 *       404:
 *         description: Edificio no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// D: Eliminar un edificio (lógico)
router.delete('/:id', eliminarEdificioLogico);

export default router;
