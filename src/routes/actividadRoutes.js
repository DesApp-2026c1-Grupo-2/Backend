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

import { validarJWT, validarRol } from '../middlewares/validateJWT.js';

// Rutas de lectura — cualquier usuario autenticado
router.use(validarJWT);
router.get('/', getActividades);
router.get('/:id', getActividadById);
router.get('/:id/sugerencias', getSugerencias);

// Rutas de escritura — solo ADMIN y PERSONAL
router.post('/', validarRol('ADMIN', 'PERSONAL'), createActividad);
router.put('/:id', validarRol('ADMIN', 'PERSONAL'), updateActividad);
router.delete('/:id', validarRol('ADMIN', 'PERSONAL'), deleteActividad);

export default router;