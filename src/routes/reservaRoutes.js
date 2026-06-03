import express from "express";
const router = express.Router();
import * as reservaControllers from "../controllers/reservaControllers.js";
import { validarJWT } from "../middlewares/validateJWT.js";

// GET: Obtener todas las reservas activas (Soporta query params ?startDate=...&endDate=...)
router.get("/activas", validarJWT, reservaControllers.getReservasActivas);

// GET: Obtener reservas activas filtradas por un laboratorio específico
router.get("/laboratorio/:laboratorioId", validarJWT, reservaControllers.getReservasActivasPorLaboratorio);

// PATCH: Cancelar una reserva y liberar sus recursos (equipos y stock)
router.patch("/:id/cancelar", validarJWT, reservaControllers.cancelarReserva);

export default router;