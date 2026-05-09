const { Router } = require('express')
const router = Router()
const { crearLaboratorio, obtenerLaboratorios, obtenerLaboratorioPorId, obtenerLaboratoriosDisponibles, obtenerLaboratoriosPorEdificio } = require('../controllers/laboratorioControllers');


// C: Crear un nuevo laboratorio
router.post('/', crearLaboratorio);

// R: Obtener todos los laboratorios 
router.get('/', obtenerLaboratorios);

// R: Obtener todos los laboratorios disponibles
router.get('/disponibles', obtenerLaboratoriosDisponibles);

// R: Obtener todos los laboraorios de un edificio específico
router.get('/edificio/:idEdificio', obtenerLaboratoriosPorEdificio);

// R: Obtener un laboratorio por su ID 
router.get('/:idLaboratorio', obtenerLaboratorioPorId);

module.exports = router;