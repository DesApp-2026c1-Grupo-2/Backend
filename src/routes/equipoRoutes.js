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

import {deleteEquipo,
    updateEquipo,
    getEquipoById,
    getEquipos,
    createEquipo,
    getEstadisticasUso } from '../controllers/equipoControllers.js';

// Lecturas: cualquier usuario autenticado. Mutaciones y estadísticas: PERSONAL/ADMIN.
router.post("/", validarJWT, validarRol('PERSONAL', 'ADMIN'), validate(createEquipoSchema, 'body'), createEquipo);
router.get("/", validarJWT, validate(equipoQuerySchema, 'query'), getEquipos);
router.get("/estadisticas-uso", validarJWT, validarRol('PERSONAL', 'ADMIN'), validate(estadisticasUsoQuerySchema, 'query'), getEstadisticasUso);
router.get("/:id", validarJWT, validate(equipoIdParamSchema, 'params'), getEquipoById);
router.put("/:id", validarJWT, validarRol('PERSONAL', 'ADMIN'), validate(equipoIdParamSchema, 'params'), validate(updateEquipoSchema, 'body'), updateEquipo);
router.delete("/:id", validarJWT, validarRol('PERSONAL', 'ADMIN'), validate(equipoIdParamSchema, 'params'), deleteEquipo);

export default router;