const { Router } = require('express')
const router = Router()
const { 
    crearLaboratorio, 
    obtenerLaboratorios, 
    obtenerLaboratorioPorId, 
    obtenerLaboratoriosDisponibles, 
    obtenerLaboratoriosPorEdificio,
    actualizarEstadoLaboratorio,
    actualizarLaboratorio,
    eliminarLaboratorioLogico
} = require('../controllers/laboratorioControllers');


// C: Crear un nuevo laboratorio
router.post('/', crearLaboratorio);

// R: Obtener todos los laboratorios disponibles
router.get('/disponibles', obtenerLaboratoriosDisponibles);
router.get('/disponibles-labs', obtenerLaboratoriosDisponibles);

// R: Obtener todos los laboratorios 
router.get('/', obtenerLaboratorios);

// R: Obtener todos los laboraorios de un edificio específico
router.get('/edificio/:idEdificio', obtenerLaboratoriosPorEdificio);

// R: Obtener un laboratorio por su ID 
router.get('/:idLaboratorio', obtenerLaboratorioPorId);

// U: Actualizar el estado de un laboratorio
router.patch('/:idLaboratorio/estado', actualizarEstadoLaboratorio);
// U: Actualizar un laboratorio
router.put('/:idLaboratorio', actualizarLaboratorio);
// D: Eliminar un laboratorio (eliminación lógica)
router.delete('/:idLaboratorio', eliminarLaboratorioLogico);

module.exports = router;