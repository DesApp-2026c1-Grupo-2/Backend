import { Router } from 'express';
const router = Router();

import {
  createLote,
  getLotes,
  getLoteById,
  updateLote,
  deleteLote
} from '../controllers/loteControllers.js';

// Rutas CRUD para Lotes
router.get('/', getLotes);
router.get('/:id', getLoteById);
router.post('/', createLote);
router.put('/:id', updateLote);
router.delete('/:id', deleteLote);

export default router;