const express = require("express");
const router = express.Router();
const pedidoControllers = require("../controllers/pedidoControllers");

const validarPedido = require("../middlewares/validatePedidos");
const { validarJWT, validarRol } = require("../middlewares/validateJWT");

// GET: Obtener todos los pedidos o uno por ID
router.get("/", validarJWT, pedidoControllers.getPedidos);
router.get("/:id", validarJWT, pedidoControllers.getPedidoById);

// POST / PUT: Crear y actualizar pedidos (Pasan por el middleware de validación real)
// TODOS PUEDEN CREAR
router.post("/", validarJWT, validarPedido, pedidoControllers.createPedido);
// SOLO PERSONAL Y ADMIN PUEDEN ACTUALIZAR
router.put("/:id", validarJWT, validarRol("PERSONAL","ADMIN"), validarPedido, pedidoControllers.updatePedido);

// PATCH: Modificaciones de estado y procesos de negocio
// SOLO PERSONAL Y ADMIN PUEDEN CAMBIAR ESTADO, APROBAR O FINALIZAR
router.patch("/:id/estado", validarJWT, validarRol("PERSONAL","ADMIN"), pedidoControllers.updateEstado);
router.patch("/:id/aprobar", validarJWT, validarRol("PERSONAL","ADMIN"), pedidoControllers.aprobarPedido); // Ruta dedicada para aprobar y descontar stock
router.patch("/:id/finalizar", validarJWT, validarRol("PERSONAL","ADMIN"), pedidoControllers.finalizarPedido); // Ruta para cerrar el pedido y liberar equipos

// DELETE: Eliminar un pedido de forma lógica (SOLO ADMIN PUEDE ELIMINAR)
router.delete("/:id", validarJWT, validarRol("ADMIN"), pedidoControllers.borrarPedidoLogico);

// POST: Agregar un comentario a un pedido
router.post("/:id/comentarios", validarJWT, pedidoControllers.agregarComentario);

module.exports = router;