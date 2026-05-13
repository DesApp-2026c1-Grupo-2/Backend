const { Router } = require('express');
const router = Router();

const {
  createRecetaReactivo,
  getRecetasReactivos,
  getRecetaReactivoById,
  updateRecetaReactivo,
  deleteRecetaReactivo
} = require('../controllers/recetaReactivoControllers');

// Rutas CRUD para Recetas de Reactivos
router.get('/', getRecetasReactivos);
router.get('/:id', getRecetaReactivoById);
router.post('/', createRecetaReactivo);
router.put('/:id', updateRecetaReactivo);
router.delete('/:id', deleteRecetaReactivo);

module.exports = router;