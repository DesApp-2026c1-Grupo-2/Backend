const { Router } = require('express')
const router = Router()
const { crearLaboratorio, obtenerLaboratorios, obtenerLaboratorioPorId, obtenerLaboratoriosDisponibles } = require('../controllers/laboratorioControllers');


// C: Crear un nuevo laboratorio
router.post('/', crearLaboratorio);

// R: Obtener todos los laboratorios 
router.get('/', obtenerLaboratorios);

// R: Obtener un laboratorio por su ID 
router.get('/:idLaboratorio', obtenerLaboratorioPorId);

// R: Obtener todos los laboratorios disponibles
router.get('/disponibles', obtenerLaboratoriosDisponibles);