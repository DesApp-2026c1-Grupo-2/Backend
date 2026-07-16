import { Router } from "express";
import { registrarDescarte, getDescartes, getHistorialPorItem, getHistorialPorPedido, revertirDescarte } from "../controllers/descarteControllers.js";
import { validarJWT, validarRol } from "../middlewares/validateJWT.js";
import { validate } from "../middlewares/validator.middleware.js";
import { historialDescartesQuerySchema } from "../schemas/descarteSchema.js";

const router = Router();

// Rutas que requieren autenticación
router.use(validarJWT);

/**
 * @swagger
 * /descartes/pedidos/{id}:
 *   post:
 *     summary: Registrar un descarte sobre un pedido
 *     description: >-
 *       Registra el descarte de un recurso de la reserva del pedido. Para
 *       materiales/reactivos sólo se admiten items reutilizables
 *       (esConsumible=false) y descuenta stock por FIFO sobre los lotes usados;
 *       para equipos, los pasa a "fuera de servicio". Un DOCENTE sólo puede
 *       descartar en sus propios pedidos.
 *     tags: [Descartes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pedido
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DescarteInput'
 *     responses:
 *       201:
 *         description: Descarte registrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Descarte registrado correctamente
 *                 descarte:
 *                   $ref: '#/components/schemas/Descarte'
 *       400:
 *         description: >-
 *           Datos inválidos, item consumible, recurso ajeno a la reserva,
 *           cantidad mayor a lo reservado/disponible, o sin permiso sobre el pedido
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
 */
router.post("/pedidos/:id", registrarDescarte);

/**
 * @swagger
 * /descartes:
 *   get:
 *     summary: Historial de descartes (paginado)
 *     description: Información sensible de inventario; sólo PERSONAL/ADMIN.
 *     tags: [Descartes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [material, reactivo, equipo]
 *       - in: query
 *         name: itemId
 *         schema:
 *           type: string
 *       - in: query
 *         name: equipoId
 *         schema:
 *           type: string
 *       - in: query
 *         name: pedidoId
 *         schema:
 *           type: string
 *       - in: query
 *         name: reservaId
 *         schema:
 *           type: string
 *       - in: query
 *         name: usuarioId
 *         schema:
 *           type: string
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
 *         description: Historial paginado de descartes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: integer, example: 8 }
 *                 page: { type: integer, example: 1 }
 *                 limit: { type: integer, example: 50 }
 *                 descartes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Descarte'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol PERSONAL/ADMIN
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", validarRol('PERSONAL', 'ADMIN'), validate(historialDescartesQuerySchema, 'query'), getDescartes);

/**
 * @swagger
 * /descartes/item/{id}:
 *   get:
 *     summary: Historial de descartes de un item o equipo
 *     description: Busca por itemId o equipoId. Sólo PERSONAL/ADMIN.
 *     tags: [Descartes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del item o del equipo
 *     responses:
 *       200:
 *         description: Lista de descartes del recurso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Descarte'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol PERSONAL/ADMIN
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/item/:id", validarRol('PERSONAL', 'ADMIN'), getHistorialPorItem);

/**
 * @swagger
 * /descartes/pedido/{id}:
 *   get:
 *     summary: Historial de descartes de un pedido
 *     description: Sólo PERSONAL/ADMIN.
 *     tags: [Descartes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pedido
 *     responses:
 *       200:
 *         description: Lista de descartes del pedido
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Descarte'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol PERSONAL/ADMIN
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/pedido/:id", validarRol('PERSONAL', 'ADMIN'), getHistorialPorPedido);

/**
 * @swagger
 * /descartes/{id}:
 *   delete:
 *     summary: Revertir (eliminar) un descarte
 *     description: >-
 *       Elimina el registro y deshace su efecto: repone el stock de los
 *       reutilizables o devuelve el equipo a "disponible". Un DOCENTE sólo puede
 *       revertir descartes de sus propios pedidos. No se puede revertir un
 *       descarte de material/reactivo si el pedido ya fue Finalizado.
 *     tags: [Descartes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del descarte
 *     responses:
 *       200:
 *         description: Descarte revertido y eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Descarte revertido y eliminado correctamente.
 *       400:
 *         description: >-
 *           El descarte no existe, sin permiso sobre el pedido, o el pedido ya
 *           fue finalizado (material/reactivo)
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
 */
router.delete("/:id", revertirDescarte);

export default router;