import { Router } from 'express';
const router = Router();

import {
  createLote,
  getLotes,
  getLoteById,
  updateLote,
  transferirLote,
  deleteLote
} from '../controllers/loteControllers.js';
import { validarJWT, validarRol } from '../middlewares/validateJWT.js';
import { validate } from '../middlewares/validator.middleware.js';
import { transferirLoteSchema } from '../schemas/loteSchema.js';

// Rutas CRUD para Lotes
router.get('/', getLotes);
router.get('/:id', getLoteById);
router.post('/', createLote);
router.put('/:id', updateLote);

// Transferir/devolver un lote entre depósito y laboratorios. Operación de inventario
// gestionada por PERSONAL/ADMIN (a diferencia del CRUD, que hoy no está gateado).
router.post(
  '/:id/transferir',
  validarJWT,
  validarRol('PERSONAL', 'ADMIN'),
  validate(transferirLoteSchema),
  transferirLote
);

router.delete('/:id', deleteLote);

export default router;
