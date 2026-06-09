import express from "express";
const router = express.Router();
import * as pedidoControllers from "../controllers/pedidoControllers.js";

import validarPedido from "../middlewares/validatePedidos.js";
import { validarJWT, validarRol } from "../middlewares/validateJWT.js";

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

// PATCH: Marcar comentarios como vistos por un usuario
router.patch("/:id/comentarios/visto", validarJWT, pedidoControllers.marcarComentariosVistos);

export default router;
