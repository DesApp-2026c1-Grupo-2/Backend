const { Router } = require('express');
const router = Router();

const {
  createProduccionReactivo,
  getProduccionesReactivos,
  getProduccionReactivoById,
  updateProduccionReactivo,
  deleteProduccionReactivo
} = require('../controllers/produccionReactivoControllers');

// Rutas CRUD para Producción de Reactivos
router.get('/', getProduccionesReactivos);
router.get('/:id', getProduccionReactivoById);
router.post('/', createProduccionReactivo);
router.put('/:id', updateProduccionReactivo);
router.delete('/:id', deleteProduccionReactivo);

module.exports = router;