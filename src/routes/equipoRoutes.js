import { Router } from "express";
const router = Router()

import { validate } from '../middlewares/validator.middleware.js';
import { validarJWT, validarRol } from '../middlewares/validateJWT.js';
import {
    createEquipoSchema,
    updateEquipoSchema,
    equipoIdParamSchema,
    equipoQuerySchema,
    estadisticasUsoQuerySchema
} from "../schemas/equipoSchema.js";
import {
    registrarMantenimientoSchema,
    finalizarMantenimientoSchema,
    historialMantenimientoQuerySchema
} from "../schemas/historialMantenimientoSchema.js";

import {deleteEquipo,
    updateEquipo,
    getEquipoById,
    getEquipos,
    createEquipo,
    getEstadisticasUso } from '../controllers/equipoControllers.js';
import {
    registrarMantenimiento,
    finalizarMantenimiento,
    getHistorialMantenimiento
} from '../controllers/historialMantenimientoControllers.js';

router.post("/", validate(createEquipoSchema, 'body'), createEquipo);
router.get("/", validate(equipoQuerySchema, 'query'), getEquipos);
router.get("/estadisticas-uso",validarJWT,validarRol('PERSONAL', 'ADMIN'),validate(estadisticasUsoQuerySchema, 'query'),getEstadisticasUso)

// Historial de mantenimiento (sub-recurso del equipo)
router.post("/:id/mantenimientos", validarJWT, validarRol('PERSONAL', 'ADMIN'), validate(equipoIdParamSchema, 'params'), validate(registrarMantenimientoSchema, 'body'), registrarMantenimiento);
router.patch("/:id/mantenimientos/finalizar", validarJWT, validarRol('PERSONAL', 'ADMIN'), validate(equipoIdParamSchema, 'params'), validate(finalizarMantenimientoSchema, 'body'), finalizarMantenimiento);
router.get("/:id/mantenimientos", validarJWT, validate(equipoIdParamSchema, 'params'), validate(historialMantenimientoQuerySchema, 'query'), getHistorialMantenimiento);

router.get("/:id", validate(equipoIdParamSchema, 'params'), getEquipoById);
router.put("/:id", validate(equipoIdParamSchema, 'params'), validate(updateEquipoSchema, 'body'), updateEquipo);
router.delete("/:id", validate(equipoIdParamSchema, 'params'), deleteEquipo);

export default router;