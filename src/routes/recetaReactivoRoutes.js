import { Router } from 'express';
const router = Router();

import {
  createRecetaReactivo,
  getRecetasReactivos,
  getRecetaReactivoById,
  updateRecetaReactivo,
  deleteRecetaReactivo
} from '../controllers/recetaReactivoControllers.js';

// Rutas CRUD para Recetas de Reactivos
router.get('/', getRecetasReactivos);
router.get('/:id', getRecetaReactivoById);
router.post('/', createRecetaReactivo);
router.put('/:id', updateRecetaReactivo);
router.delete('/:id', deleteRecetaReactivo);

export default router;