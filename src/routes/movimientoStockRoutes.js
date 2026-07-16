import { Router } from "express";
import { getMovimientos, getMovimientosPorItem } from "../controllers/movimientoStockControllers.js";
import { validarJWT } from "../middlewares/validateJWT.js";
import { validate } from "../middlewares/validator.middleware.js";
import { movimientosQuerySchema } from "../schemas/movimientoStockSchema.js";

const router = Router();

// El historial de movimientos es información sensible de inventario: requiere auth.
router.use(validarJWT);

/**
 * @swagger
 * /movimientos:
 *   get:
 *     summary: Historial de movimientos de stock (paginado)
 *     description: Información sensible de inventario; requiere autenticación.
 *     tags: [Movimientos de Stock]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: itemId
 *         schema:
 *           type: string
 *       - in: query
 *         name: tipoMovimiento
 *         schema:
 *           type: string
 *           enum: [APROBACION_RESERVA, DEVOLUCION, DESCARTE, COMPRA, AJUSTE_MANUAL, TRANSFERENCIA, BAJA]
 *       - in: query
 *         name: reservaId
 *         schema:
 *           type: string
 *       - in: query
 *         name: laboratorioId
 *         schema:
 *           type: string
 *         description: Filtra por laboratorio de origen o destino
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filtra por createdAt >= desde (ISO)
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filtra por createdAt <= hasta (ISO). No puede ser anterior a desde.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       200:
 *         description: Historial paginado de movimientos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: integer, example: 120 }
 *                 page: { type: integer, example: 1 }
 *                 limit: { type: integer, example: 50 }
 *                 movimientos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MovimientoStock'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", validate(movimientosQuerySchema, 'query'), getMovimientos);

/**
 * @swagger
 * /movimientos/item/{id}:
 *   get:
 *     summary: Historial de movimientos de un item (paginado)
 *     description: Equivale a GET /movimientos con ?itemId=. Requiere autenticación.
 *     tags: [Movimientos de Stock]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del item
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       200:
 *         description: Historial paginado del item
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: integer, example: 15 }
 *                 page: { type: integer, example: 1 }
 *                 limit: { type: integer, example: 50 }
 *                 movimientos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MovimientoStock'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/item/:id", getMovimientosPorItem);

export default router;
