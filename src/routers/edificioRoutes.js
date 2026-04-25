const { Router } = require('express')
const router = Router()
const { crearEdificio, obtenerEdificios } = require('../controllers/edificioControllers');


// C: Crear un nuevo edificio
router.post('/', crearEdificio);

// R: Obtener todos los edificios
router.get('/', obtenerEdificios);