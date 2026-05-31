const express = require("express");
const router = express.Router();
const reservaControllers = require("../controllers/reservaControllers");
const { validarJWT } = require("../middlewares/validateJWT");

// GET: Obtener todas las reservas activas (Soporta query params ?startDate=...&endDate=...)
router.get("/activas", validarJWT, reservaControllers.getReservasActivas);

// GET: Obtener reservas activas filtradas por un laboratorio específico
router.get("/laboratorio/:laboratorioId", validarJWT, reservaControllers.getReservasActivasPorLaboratorio);

// PATCH: Cancelar una reserva y liberar sus recursos (equipos y stock)
router.patch("/:id/cancelar", validarJWT, reservaControllers.cancelarReserva);

module.exports = router;