import { Router } from "express";
const router = Router()

import { validate } from '../middlewares/validator.middleware.js';
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

router.post("/", validate(createEquipoSchema, 'body'), createEquipo);
router.get("/", validate(equipoQuerySchema, 'query'), getEquipos);
router.get("/:id", validate(equipoIdParamSchema, 'params'), getEquipoById);
router.put("/:id", validate(equipoIdParamSchema, 'params'), validate(updateEquipoSchema, 'body'), updateEquipo);
router.delete("/:id", validate(equipoIdParamSchema, 'params'), deleteEquipo);

export default router;