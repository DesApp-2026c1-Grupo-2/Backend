import { Router } from 'express';
const router = Router();

import {
  createItem,
  getItems,
  getEstadisticasItems,
  getItemById,
  getStockItem,
  updateItem,
  deleteItemLogico
} from '../controllers/itemControllers.js';

import validarItem from '../middlewares/validateItems.js';
import { validate } from '../middlewares/validator.middleware.js';
import { itemQuerySchema } from '../schemas/itemSchema.js';

// Rutas CRUD para Items
router.get('/', validate(itemQuerySchema, 'query'), getItems);
router.get('/estadisticas', getEstadisticasItems); // Antes de /:id para no capturarlo como id
router.get('/:id/stock', getStockItem); // Vista de stock por rango (§14)
router.get('/:id', getItemById);
router.post('/', validarItem, createItem);
router.put('/:id', validarItem, updateItem);
router.delete('/:id', deleteItemLogico);

export default router;