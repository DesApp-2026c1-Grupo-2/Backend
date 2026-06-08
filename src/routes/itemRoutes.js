import { Router } from 'express';
const router = Router();

import {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItemLogico
} from '../controllers/itemControllers.js';

import validarItem from '../middlewares/validateItems.js';

// Rutas CRUD para Items
router.get('/', getItems);
router.get('/:id', getItemById);
router.post('/', validarItem, createItem);
router.put('/:id', validarItem, updateItem);
router.delete('/:id', deleteItemLogico);

export default router;