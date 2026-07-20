import express from "express";
const router = express.Router();
import * as reservaControllers from "../controllers/reservaControllers.js";
import { validarJWT, validarRol } from "../middlewares/validateJWT.js";
import { validate } from "../middlewares/validator.middleware.js";
import { finalizarReservaSchema } from "../schemas/reservaSchema.js";

/**
 * @swagger
 * /reservas/activas:
 *   get:
 *     summary: Listar todas las reservas activas (Pendiente / En Curso)
 *     description: Ideal para el calendario general. Opcionalmente filtra por rango de fechas.
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Inicio del rango (filtra por fechaHora). Requiere endDate.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fin del rango. Requiere startDate.
 *     responses:
 *       200:
 *         description: Lista de reservas activas (con laboratorio, docente y pedido populados)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Reserva'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET: Obtener todas las reservas activas (Soporta query params ?startDate=...&endDate=...)
router.get("/activas", validarJWT, reservaControllers.getReservasActivas);

/**
 * @swagger
 * /reservas/finalizadas:
 *   get:
 *     summary: Listar reservas finalizadas por rango de fechas
 *     description: >-
 *       Calendario histórico. El rango (startDate/endDate) es obligatorio
 *       porque las finalizadas se acumulan indefinidamente.
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Inicio del rango
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fin del rango
 *       - in: query
 *         name: laboratorioId
 *         schema:
 *           type: string
 *         description: Filtra por laboratorio (opcional)
 *     responses:
 *       200:
 *         description: Lista de reservas finalizadas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Reserva'
 *       400:
 *         description: Falta startDate/endDate o son inválidos
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
// GET: reservas finalizadas por rango de fechas (calendario histórico).
// Requiere ?startDate=...&endDate=... ; acepta ?laboratorioId= opcional.
router.get("/finalizadas", validarJWT, reservaControllers.getReservasFinalizadas);

/**
 * @swagger
 * /reservas/laboratorio/{laboratorioId}:
 *   get:
 *     summary: Listar reservas activas de un laboratorio
 *     description: Devuelve las reservas Pendiente/En Curso del laboratorio, ordenadas cronológicamente.
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: laboratorioId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del laboratorio
 *     responses:
 *       200:
 *         description: Lista de reservas activas del laboratorio
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Reserva'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET: Obtener reservas activas filtradas por un laboratorio específico
router.get("/laboratorio/:laboratorioId", validarJWT, reservaControllers.getReservasActivasPorLaboratorio);

/**
 * @swagger
 * /reservas/pedido/{pedidoId}:
 *   get:
 *     summary: Obtener la reserva de un pedido con el detalle de consumo a reportar
 *     description: >-
 *       Alimenta el diálogo de finalización del front: devuelve la reserva
 *       asociada al pedido y, por cada material, si hay que reportar el consumo
 *       real y cuánto queda físicamente afuera. Requiere rol PERSONAL o ADMIN
 *       (el mismo que PATCH /pedidos/{id}/finalizar, la acción que habilita).
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pedidoId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pedido
 *     responses:
 *       200:
 *         description: Reserva del pedido con el detalle de materiales reservados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reservaId:
 *                   type: string
 *                 pedidoId:
 *                   type: string
 *                 estado:
 *                   type: string
 *                   example: En Curso
 *                 requiereReporteConsumo:
 *                   type: boolean
 *                   description: true si algún material exige cantidadConsumida al finalizar
 *                 materialesReservados:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       itemId:
 *                         type: string
 *                       nombre:
 *                         type: string
 *                       cantidadTotal:
 *                         type: number
 *                       esConsumible:
 *                         type: boolean
 *                         nullable: true
 *                       consumoEjecutado:
 *                         type: boolean
 *                       liquidado:
 *                         type: boolean
 *                       requiereConsumo:
 *                         type: boolean
 *                       cantidadPendiente:
 *                         type: number
 *                         description: Tope de lo que se puede reportar como consumido
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
 *         description: No hay una reserva asociada a ese pedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET: reserva asociada a un pedido, con el detalle de qué consumibles hay que
// reportar al finalizarlo (alimenta el diálogo de finalización del front). Mismo
// rol que PATCH /pedidos/:id/finalizar, que es la acción que habilita.
// Va antes que cualquier ruta "/:id" para que no la capture.
router.get(
  "/pedido/:pedidoId",
  validarJWT,
  validarRol("PERSONAL", "ADMIN"),
  reservaControllers.getReservaPorPedido
);

/**
 * @swagger
 * /reservas/{id}/cancelar:
 *   patch:
 *     summary: Cancelar una reserva y liberar sus recursos
 *     description: >-
 *       Marca la reserva como Cancelada y rechaza el pedido original. Si estaba
 *       "En Curso", repone el stock que se había consumido físicamente.
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la reserva
 *     responses:
 *       200:
 *         description: Reserva cancelada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Reserva cancelada exitosamente. Se liberaron los equipos.
 *                 reserva:
 *                   $ref: '#/components/schemas/Reserva'
 *       400:
 *         description: La reserva ya está Cancelada o Finalizada
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
 *       404:
 *         description: Reserva no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PATCH: Cancelar una reserva y liberar sus recursos (equipos y stock)
router.patch("/:id/cancelar", validarJWT, reservaControllers.cancelarReserva);

/**
 * @swagger
 * /reservas/{id}/finalizar:
 *   patch:
 *     summary: Finalizar a mano una reserva En Curso reportando el consumo real
 *     description: >-
 *       Cierra una reserva "En Curso" (En Curso → Finalizada), devuelve el
 *       sobrante de los consumibles (reservado − consumido) y el 100% de los
 *       reutilizables. Los consumibles ya descontados requieren su
 *       cantidadConsumida. Requiere rol PERSONAL o ADMIN.
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la reserva
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinalizarReservaInput'
 *     responses:
 *       200:
 *         description: Reserva finalizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Reserva finalizada exitosamente
 *                 reserva:
 *                   $ref: '#/components/schemas/Reserva'
 *       400:
 *         description: >-
 *           Datos inválidos, falta reportar el consumo de un consumible, o la
 *           reserva no está En Curso
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
 *         description: Reserva no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PATCH: Finalizar a mano una reserva En Curso reportando el consumo real de los
// consumibles (devuelve el sobrante). Gestionado por PERSONAL/ADMIN.
router.patch(
  "/:id/finalizar",
  validarJWT,
  validarRol("PERSONAL", "ADMIN"),
  validate(finalizarReservaSchema),
  reservaControllers.finalizarReserva
);

export default router;