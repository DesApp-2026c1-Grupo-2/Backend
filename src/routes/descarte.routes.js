import { Router } from "express";
import { registrarDescarte, getDescartes, getHistorialPorItem, getHistorialPorPedido, revertirDescarte } from "../controllers/descarteControllers.js";
import { validarJWT, validarRol } from "../middlewares/validateJWT.js";
import { validate } from "../middlewares/validator.middleware.js";
import { historialDescartesQuerySchema } from "../schemas/descarteSchema.js";
import validarRegistrarDescarte from "../middlewares/validateDescartes.js";
const router = Router();

// Rutas que requieren autenticación
router.use(validarJWT);

router.post("/pedidos/:id",validarRegistrarDescarte, registrarDescarte);

// El historial de descartes es información sensible de inventario: solo PERSONAL/ADMIN.
router.get("/", validarRol('PERSONAL', 'ADMIN'), validate(historialDescartesQuerySchema, 'query'), getDescartes);
router.get("/item/:id", validarRol('PERSONAL', 'ADMIN'), getHistorialPorItem);
router.get("/pedido/:id", validarRol('PERSONAL', 'ADMIN'), getHistorialPorPedido);
router.delete("/:id", revertirDescarte);

export default router;