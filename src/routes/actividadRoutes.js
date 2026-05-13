const { Router } = require('express');
const router = Router();

const {
  createActividad,
  getActividades,
  getActividadById,
  updateActividad,
  deleteActividad
} = require('../controllers/actividadControllers');

// Rutas CRUD para Actividades
router.get('/', getActividades);
router.get('/:id', getActividadById);
router.post('/', createActividad);
router.put('/:id', updateActividad);
router.delete('/:id', deleteActividad);

module.exports = router;