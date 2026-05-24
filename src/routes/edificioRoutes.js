const { Router } = require('express')
const router = Router()
const { crearEdificio, obtenerEdificios, obtenerEdificioPorId, actualizarEdificio,eliminarEdificioLogico} = require('../controllers/edificioControllers');


// C: Crear un nuevo edificio
router.post('/', crearEdificio);

// R: Obtener todos los edificios
router.get('/', obtenerEdificios);

// R: Obtener un edificio por ID
router.get('/:id', obtenerEdificioPorId);
// U: Actualizar un edificio
router.put('/:id', actualizarEdificio);
// D: Eliminar un edificio (lógico)
router.delete('/:id', eliminarEdificioLogico);
module.exports = router;