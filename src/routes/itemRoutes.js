const { Router } = require('express');
const router = Router();

const {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItemLogico
} = require('../controllers/itemControllers');

const validarItem = require('../middlewares/validateItems');

// Rutas CRUD para Items
router.get('/', getItems);
router.get('/:id', getItemById);
router.post('/', validarItem, createItem);
router.put('/:id', validarItem, updateItem);
router.delete('/:id', deleteItemLogico);

module.exports = router;