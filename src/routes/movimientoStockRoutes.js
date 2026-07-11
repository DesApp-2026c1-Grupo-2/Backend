import { Router } from "express";
import { getMovimientos, getMovimientosPorItem } from "../controllers/movimientoStockControllers.js";
import { validarJWT } from "../middlewares/validateJWT.js";
import { validate } from "../middlewares/validator.middleware.js";
import { movimientosQuerySchema } from "../schemas/movimientoStockSchema.js";

const router = Router();

// El historial de movimientos es información sensible de inventario: requiere auth.
router.use(validarJWT);

router.get("/", validate(movimientosQuerySchema, 'query'), getMovimientos);
router.get("/item/:id", getMovimientosPorItem);

export default router;
