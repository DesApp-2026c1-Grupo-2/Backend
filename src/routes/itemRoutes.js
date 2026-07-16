import { Router } from 'express';
const router = Router();

import {
  createItem,
  getItems,
  getEstadisticasItems,
  getItemById,
  getStockItem,
  updateItem,
  deleteItemLogico
} from '../controllers/itemControllers.js';

import validarItem from '../middlewares/validateItems.js';
import { validate } from '../middlewares/validator.middleware.js';
import { itemQuerySchema } from '../schemas/itemSchema.js';

// Rutas CRUD para Items

/**
 * @swagger
 * /items:
 *   get:
 *     summary: Listar items (con búsqueda, orden y paginación)
 *     description: Cada item incluye su stockDisponible calculado sobre los lotes.
 *     tags: [Items]
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [sustancia, reactivo, material]
 *         description: Filtra por tipo
 *       - in: query
 *         name: esConsumible
 *         schema:
 *           type: boolean
 *         description: Filtra por consumible / reutilizable
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Búsqueda parcial (case-insensitive) sobre nombre o código
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [nombre, codigo]
 *           default: nombre
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *     responses:
 *       200:
 *         description: Lista paginada de items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 25
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 20
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Item'
 */
router.get('/', validate(itemQuerySchema, 'query'), getItems);

/**
 * @swagger
 * /items/estadisticas:
 *   get:
 *     summary: Conteos agregados para la pantalla de Stock
 *     description: >-
 *       Devuelve la cantidad de equipos activos, items por tipo
 *       (materiales/reactivos/sustancias) y lotes descartados.
 *     tags: [Items]
 *     responses:
 *       200:
 *         description: Conteos agregados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 equipos: { type: integer, example: 12 }
 *                 materiales: { type: integer, example: 8 }
 *                 reactivos: { type: integer, example: 15 }
 *                 sustancias: { type: integer, example: 5 }
 *                 descartes: { type: integer, example: 3 }
 */
router.get('/estadisticas', getEstadisticasItems); // Antes de /:id para no capturarlo como id

/**
 * @swagger
 * /items/{id}/stock:
 *   get:
 *     summary: Desglose de stock de un item para un rango horario
 *     description: >-
 *       Devuelve el stock total y disponible del item en la ventana indicada,
 *       más el detalle de reservas Pendientes (aceptado) y En Curso (enUso).
 *       Si no se envían `desde`/`hasta`, se usa el día actual completo.
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del item
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Inicio de la ventana (ISO). Debe ser anterior a hasta.
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fin de la ventana (ISO)
 *     responses:
 *       200:
 *         description: Desglose de stock
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 itemId: { type: string, example: '665f1a2b3c4d5e6f7a8b9c0d' }
 *                 desde: { type: string, format: date-time }
 *                 hasta: { type: string, format: date-time }
 *                 total:
 *                   type: number
 *                   description: Stock físico total
 *                   example: 1000
 *                 disponible:
 *                   type: number
 *                   description: Stock disponible en la ventana
 *                   example: 700
 *                 aceptado:
 *                   type: array
 *                   description: Reservas Pendientes que afectan la ventana
 *                   items:
 *                     type: object
 *                 enUso:
 *                   type: array
 *                   description: Reservas En Curso que afectan la ventana
 *                   items:
 *                     type: object
 *       400:
 *         description: Parámetros desde/hasta inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Ítem no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/stock', getStockItem); // Vista de stock por rango (§14)

/**
 * @swagger
 * /items/{id}:
 *   get:
 *     summary: Obtener un item por ID (incluye stock disponible)
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del item
 *     responses:
 *       200:
 *         description: Item encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Item'
 *       404:
 *         description: Ítem no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', getItemById);

/**
 * @swagger
 * /items:
 *   post:
 *     summary: Crear un nuevo item
 *     tags: [Items]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ItemInput'
 *     responses:
 *       201:
 *         description: Item creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Item'
 *       400:
 *         description: Datos inválidos o código duplicado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', validarItem, createItem);

/**
 * @swagger
 * /items/{id}:
 *   put:
 *     summary: Actualizar un item
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del item
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ItemInput'
 *     responses:
 *       200:
 *         description: Item actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Item'
 *       400:
 *         description: Datos inválidos o código duplicado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Ítem no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', validarItem, updateItem);

/**
 * @swagger
 * /items/{id}:
 *   delete:
 *     summary: Eliminar un item (borrado lógico)
 *     description: >-
 *       No elimina el documento; marca `activo = false`. Falla si el item tiene
 *       lotes registrados en el inventario.
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del item
 *     responses:
 *       200:
 *         description: Item marcado como eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Ítem marcado como eliminado (borrado lógico)
 *                 item:
 *                   $ref: '#/components/schemas/Item'
 *       404:
 *         description: Ítem no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: El item tiene lotes asociados; no puede eliminarse
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', deleteItemLogico);

export default router;