const { Router } = require('express');
const router = Router();

const {
  createLote,
  getLotes,
  getLoteById,
  updateLote,
  deleteLote
} = require('../controllers/loteControllers');

// Rutas CRUD para Lotes
router.get('/', getLotes);
router.get('/:id', getLoteById);
router.post('/', createLote);
router.put('/:id', updateLote);
router.delete('/:id', deleteLote);

module.exports = router;