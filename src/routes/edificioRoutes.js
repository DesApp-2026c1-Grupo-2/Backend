import { Router } from 'express';
const router = Router()
import { crearEdificio, obtenerEdificios, obtenerEdificioPorId, actualizarEdificio,eliminarEdificioLogico} from '../controllers/edificioControllers.js';


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

export default router;