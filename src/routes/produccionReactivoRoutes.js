import { Router } from 'express';
const router = Router();

import {
  createProduccionReactivo,
  getProduccionesReactivos,
  getProduccionReactivoById,
  updateProduccionReactivo,
  deleteProduccionReactivo
} from '../controllers/produccionReactivoControllers.js';

// Rutas CRUD para Producción de Reactivos
router.get('/', getProduccionesReactivos);
router.get('/:id', getProduccionReactivoById);
router.post('/', createProduccionReactivo);
router.put('/:id', updateProduccionReactivo);
router.delete('/:id', deleteProduccionReactivo);

export default router;