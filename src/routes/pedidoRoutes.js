const express = require("express");
const router = express.Router();
const pedidoControllers = require("../controllers/pedidoControllers");
const validarPedido = require("../middlewares/validatePedidos");

// GET: Obtener todos los pedidos o uno por ID
router.get("/", pedidoControllers.getPedidos);
router.get("/:id", pedidoControllers.getPedidoById);

// POST / PUT: Crear y actualizar pedidos (Pasan por el middleware de validación real)
router.post("/", validarPedido, pedidoControllers.createPedido);
router.put("/:id", validarPedido, pedidoControllers.updatePedido);

// PATCH: Modificaciones de estado y procesos de negocio
router.patch("/:id/estado", pedidoControllers.updateEstado);
router.patch("/:id/aprobar", pedidoControllers.aprobarPedido); // Ruta dedicada para aprobar y descontar stock
router.patch("/:id/finalizar", pedidoControllers.finalizarPedido); // Ruta para cerrar el pedido y liberar equipos

router.delete("/:id", pedidoControllers.borrarPedido);

module.exports = router;