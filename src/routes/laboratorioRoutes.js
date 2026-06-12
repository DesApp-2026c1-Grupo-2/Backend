import { Router } from 'express';
const router = Router()
import { 
    crearLaboratorio, 
    obtenerLaboratorios, 
    obtenerLaboratorioPorId, 
    obtenerLaboratoriosDisponibles, 
    obtenerLaboratoriosPorEdificio,
    actualizarEstadoLaboratorio,
    actualizarLaboratorio,
    eliminarLaboratorioLogico,
    obtenerLaboratoriosDisponiblesPorHorario
} from '../controllers/laboratorioControllers.js';


// C: Crear un nuevo laboratorio
router.post('/', crearLaboratorio);

// R: Obtener todos los laboratorios disponibles
router.get('/disponibles', obtenerLaboratoriosDisponibles);
router.get('/disponibles-labs', obtenerLaboratoriosDisponibles);
router.get('/disponibles-horario', obtenerLaboratoriosDisponiblesPorHorario);
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

export default router;