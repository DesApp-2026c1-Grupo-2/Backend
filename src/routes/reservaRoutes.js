import express from "express";
const router = express.Router();
import * as reservaControllers from "../controllers/reservaControllers.js";
import { validarJWT, validarRol } from "../middlewares/validateJWT.js";
import { validate } from "../middlewares/validator.middleware.js";
import { finalizarReservaSchema } from "../schemas/reservaSchema.js";

// GET: Obtener todas las reservas activas (Soporta query params ?startDate=...&endDate=...)
router.get("/activas", validarJWT, reservaControllers.getReservasActivas);

// GET: reservas finalizadas por rango de fechas (calendario histórico).
// Requiere ?startDate=...&endDate=... ; acepta ?laboratorioId= opcional.
router.get("/finalizadas", validarJWT, reservaControllers.getReservasFinalizadas);

// GET: Obtener reservas activas filtradas por un laboratorio específico
router.get("/laboratorio/:laboratorioId", validarJWT, reservaControllers.getReservasActivasPorLaboratorio);

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

// PATCH: Cancelar una reserva y liberar sus recursos (equipos y stock)
router.patch("/:id/cancelar", validarJWT, reservaControllers.cancelarReserva);

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