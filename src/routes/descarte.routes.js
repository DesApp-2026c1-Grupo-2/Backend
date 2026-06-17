import { Router } from "express";
import { registrarDescarte, getHistorialPorItem, getHistorialPorPedido, revertirDescarte } from "../controllers/descarteControllers.js";
import { validarJWT } from "../middlewares/validateJWT.js";

const router = Router();

// Rutas que requieren autenticación
router.use(validarJWT);

router.post("/pedidos/:id", registrarDescarte);

router.get("/item/:id", getHistorialPorItem);
router.get("/pedido/:id", getHistorialPorPedido);
router.delete("/:id", revertirDescarte);

export default router;