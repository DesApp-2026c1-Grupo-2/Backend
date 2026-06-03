import { Router } from "express";
const router = Router()

import validateSchema from "../middlewares/validateSchema.js";
import { 
    createEquipoSchema, 
    updateEquipoSchema, 
    equipoIdParamSchema, 
    equipoQuerySchema 
} from "../schemas/equipoSchema.js";

import {deleteEquipo,
    updateEquipo,
    getEquipoById,
    getEquipos,
    createEquipo } from '../controllers/equipoControllers.js';

router.post("/", validateSchema(createEquipoSchema, 'body'), createEquipo);
router.get("/", validateSchema(equipoQuerySchema, 'query'), getEquipos);
router.get("/:id", validateSchema(equipoIdParamSchema, 'params'), getEquipoById);
router.put("/:id", validateSchema(equipoIdParamSchema, 'params'), validateSchema(updateEquipoSchema, 'body'), updateEquipo);
router.delete("/:id", validateSchema(equipoIdParamSchema, 'params'), deleteEquipo);

export default router;