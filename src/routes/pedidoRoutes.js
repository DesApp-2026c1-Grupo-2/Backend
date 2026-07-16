import express from "express";
const router = express.Router();
import * as pedidoControllers from "../controllers/pedidoControllers.js";

import { validate } from "../middlewares/validator.middleware.js";
import pedidoSchemaJoi, { finalizarPedidoSchema } from "../schemas/pedidoSchema.js";
import { validarPedido, puedeEditarPedido } from "../middlewares/validatePedidos.js";
import { validarJWT, validarRol } from "../middlewares/validateJWT.js";

/**
 * @swagger
 * /pedido:
 *   get:
 *     summary: Listar pedidos
 *     description: >-
 *       Un DOCENTE sólo ve sus propios pedidos; PERSONAL/ADMIN ven todos. Los
 *       pedidos Pendientes cuya fechaHora ya pasó se marcan como Expirado. Cada
 *       pedido incluye `tieneComentariosNuevos`.
 *     tags: [Pedidos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de pedidos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Pedido'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET: Obtener todos los pedidos o uno por ID
router.get("/", validarJWT, pedidoControllers.getPedidos);

/**
 * @swagger
 * /pedido/{id}:
 *   get:
 *     summary: Obtener un pedido por ID
 *     description: >-
 *       Incluye el array `conflictos` (disponibilidad evaluada al momento de la
 *       consulta). Un DOCENTE sólo puede ver sus propios pedidos.
 *     tags: [Pedidos]
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
 *         description: Pedido encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pedido'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El docente no es dueño del pedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id", validarJWT, pedidoControllers.getPedidoById);

/**
 * @swagger
 * /pedido:
 *   post:
 *     summary: Crear un nuevo pedido
 *     description: >-
 *       Cualquier usuario autenticado puede crear. Debe respetar la anticipación
 *       mínima configurada. El laboratorio puede asignarse más tarde.
 *     tags: [Pedidos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PedidoInput'
 *     responses:
 *       201:
 *         description: Pedido creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pedido'
 *       400:
 *         description: Datos inválidos o anticipación insuficiente
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
// POST / PUT: Crear y actualizar pedidos (Pasan por el middleware de validación real)
// TODOS PUEDEN CREAR
router.post("/", validarJWT, validate(pedidoSchemaJoi), validarPedido, pedidoControllers.createPedido);

/**
 * @swagger
 * /pedido/{id}:
 *   put:
 *     summary: Actualizar un pedido
 *     description: >-
 *       Sujeto a la regla `puedeEditarPedido` (según estado y rol). Los cambios
 *       se registran en el historial del pedido.
 *     tags: [Pedidos]
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
 *             $ref: '#/components/schemas/PedidoInput'
 *     responses:
 *       200:
 *         description: Pedido actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pedido'
 *       400:
 *         description: Datos inválidos o edición no permitida en el estado actual
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
 *         description: No autorizado a editar este pedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put("/:id", validarJWT, puedeEditarPedido, validate(pedidoSchemaJoi), validarPedido, pedidoControllers.updatePedido);

/**
 * @swagger
 * /pedido/{id}/estado:
 *   patch:
 *     summary: Cambiar el estado de un pedido
 *     description: >-
 *       Sólo PERSONAL/ADMIN. Cancelar un pedido Aceptado libera su reserva,
 *       stock y equipos. Al rechazar se puede indicar `motivoRechazo`.
 *     tags: [Pedidos]
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
 *             $ref: '#/components/schemas/PedidoEstadoInput'
 *     responses:
 *       200:
 *         description: Estado actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pedido'
 *       400:
 *         description: Estado no válido o transición no permitida
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
 *         description: El usuario no tiene rol PERSONAL/ADMIN
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PATCH: Modificaciones de estado y procesos de negocio
// SOLO PERSONAL Y ADMIN PUEDEN CAMBIAR ESTADO, APROBAR O FINALIZAR
router.patch("/:id/estado", validarJWT, validarRol("PERSONAL","ADMIN"), pedidoControllers.updateEstado);

/**
 * @swagger
 * /pedido/{id}/aprobar:
 *   patch:
 *     summary: Aprobar un pedido (crea la reserva y descuenta stock)
 *     description: >-
 *       Sólo PERSONAL/ADMIN. Verifica conflictos, asigna lotes por FIFO, genera
 *       el checklist y crea la Reserva asociada. El pedido pasa a "Aceptado".
 *     tags: [Pedidos]
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
 *         description: Pedido aprobado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Pedido aprobado. Reserva creada y disponibilidad confirmada.
 *                 pedido:
 *                   $ref: '#/components/schemas/Pedido'
 *                 reservaId:
 *                   type: string
 *                   example: '665f1a2b3c4d5e6f7a8b9c0f'
 *       400:
 *         description: >-
 *           El pedido ya no está Pendiente, o tiene conflictos (se incluye
 *           `conflictos` en la respuesta)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Error'
 *                 - type: object
 *                   properties:
 *                     conflictos:
 *                       type: array
 *                       items:
 *                         type: object
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
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/:id/aprobar", validarJWT, validarRol("PERSONAL","ADMIN"), pedidoControllers.aprobarPedido); // Ruta dedicada para aprobar y descontar stock

/**
 * @swagger
 * /pedido/{id}/finalizar:
 *   patch:
 *     summary: Finalizar un pedido Aceptado y registrar novedades
 *     description: >-
 *       Sólo PERSONAL/ADMIN. Cierra el pedido (pasa a "Finalizado"), registra
 *       descartes/desperfectos y finaliza la reserva devolviendo el stock
 *       (reutilizables 100% y sobrante de consumibles según `consumos`). Los
 *       consumibles ya descontados requieren su consumo reportado.
 *     tags: [Pedidos]
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinalizarPedidoInput'
 *     responses:
 *       200:
 *         description: Pedido finalizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Pedido finalizado y novedades registradas.
 *                 pedido:
 *                   $ref: '#/components/schemas/Pedido'
 *       400:
 *         description: >-
 *           El pedido no está Aceptado, falta reportar el consumo de un
 *           consumible, o un descarte apunta a un consumible
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
 *         description: El usuario no tiene rol PERSONAL/ADMIN
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/:id/finalizar", validarJWT, validarRol("PERSONAL","ADMIN"), validate(finalizarPedidoSchema), pedidoControllers.finalizarPedido); // Ruta para cerrar el pedido y liberar equipos

/**
 * @swagger
 * /pedido/{id}/checklist:
 *   patch:
 *     summary: Actualizar el checklist de un pedido
 *     description: Reemplaza el checklist completo. Sólo PERSONAL/ADMIN.
 *     tags: [Pedidos]
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
 *             $ref: '#/components/schemas/ChecklistInput'
 *     responses:
 *       200:
 *         description: Checklist actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pedido'
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
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
//updateChecklist
router.patch("/:id/checklist", validarJWT, validarRol("PERSONAL","ADMIN"), pedidoControllers.updateChecklist);

/**
 * @swagger
 * /pedido/{id}:
 *   delete:
 *     summary: Eliminar un pedido (borrado lógico)
 *     description: No elimina el documento; marca `activo = false`. Sólo ADMIN.
 *     tags: [Pedidos]
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
 *         description: Pedido eliminado lógicamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Pedido eliminado lógicamente
 *                 pedido:
 *                   $ref: '#/components/schemas/Pedido'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol ADMIN
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// DELETE: Eliminar un pedido de forma lógica (SOLO ADMIN PUEDE ELIMINAR)
router.delete("/:id", validarJWT, validarRol("ADMIN"), pedidoControllers.borrarPedidoLogico);

/**
 * @swagger
 * /pedido/{id}/comentarios:
 *   post:
 *     summary: Agregar un comentario a un pedido
 *     tags: [Pedidos]
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
 *             $ref: '#/components/schemas/ComentarioInput'
 *     responses:
 *       201:
 *         description: Comentario agregado (se devuelve el comentario creado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PedidoComentario'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST: Agregar un comentario a un pedido
router.post("/:id/comentarios", validarJWT, pedidoControllers.agregarComentario);

/**
 * @swagger
 * /pedido/{id}/comentarios/visto:
 *   patch:
 *     summary: Marcar los comentarios del pedido como vistos por el usuario actual
 *     tags: [Pedidos]
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
 *         description: Marcado como visto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PATCH: Marcar comentarios como vistos por un usuario
router.patch("/:id/comentarios/visto", validarJWT, pedidoControllers.marcarComentariosVistos);

export default router;
