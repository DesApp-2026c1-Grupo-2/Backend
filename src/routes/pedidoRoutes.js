const express = require("express");
const router = express.Router();

const {
  getPedidos,
  createPedido,
  updateEstado,
  borrarPedido,
  updatePedido,
} = require("../controllers/pedidoControllers");

const validarPedido = require("../middlewares/validatePedidos");

router.get("/", getPedidos);
router.post("/", validarPedido, createPedido);
router.put("/:id", validarPedido, updatePedido);
router.patch("/:id/estado", updateEstado);
router.delete("/:id", borrarPedido);

module.exports = router;