import { Router } from 'express';
const router = Router();

import {
  createActividad,
  getActividades,
  getActividadById,
  updateActividad,
  deleteActividad,
  getSugerencias
} from '../controllers/actividadControllers.js';

// Rutas CRUD para Actividades
router.get('/', getActividades);
router.get('/:id', getActividadById);
router.get('/:id/sugerencias', getSugerencias);
router.post('/', createActividad);
router.put('/:id', updateActividad);
router.delete('/:id', deleteActividad);

export default router;