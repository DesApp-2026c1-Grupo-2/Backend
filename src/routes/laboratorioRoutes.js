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


/**
 * @swagger
 * /laboratorio:
 *   post:
 *     summary: Crear un nuevo laboratorio
 *     tags: [Laboratorios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LaboratorioInput'
 *     responses:
 *       201:
 *         description: Laboratorio creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Laboratorio'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// C: Crear un nuevo laboratorio
router.post('/', crearLaboratorio);

/**
 * @swagger
 * /laboratorio/disponibles:
 *   get:
 *     summary: Listar laboratorios con estado "disponible"
 *     tags: [Laboratorios]
 *     responses:
 *       200:
 *         description: Lista de laboratorios disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Laboratorio'
 */
// R: Obtener todos los laboratorios disponibles
router.get('/disponibles', obtenerLaboratoriosDisponibles);

/**
 * @swagger
 * /laboratorio/disponibles-labs:
 *   get:
 *     summary: Alias de /laboratorio/disponibles
 *     description: Idéntico a `GET /laboratorio/disponibles`.
 *     tags: [Laboratorios]
 *     responses:
 *       200:
 *         description: Lista de laboratorios disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Laboratorio'
 */
router.get('/disponibles-labs', obtenerLaboratoriosDisponibles);

/**
 * @swagger
 * /laboratorio/disponibles-horario:
 *   get:
 *     summary: Listar laboratorios disponibles para un horario dado
 *     description: >-
 *       Devuelve los laboratorios "disponible" que no tienen pedidos
 *       (Pendiente/Aceptado) solapados con la ventana solicitada. Si no se
 *       envía `fechaFin`, el fin se calcula como `fechaHora + duracionClase
 *       + 30 min` (duración por defecto 120 min). La ventana de ocupación
 *       considera además 1 hora previa al inicio.
 *     tags: [Laboratorios]
 *     parameters:
 *       - in: query
 *         name: fechaHora
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha y hora de inicio solicitada (ISO 8601)
 *         example: '2026-08-01T14:00:00.000Z'
 *       - in: query
 *         name: fechaFin
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha y hora de fin. Si se omite, se calcula con duracionClase.
 *       - in: query
 *         name: duracionClase
 *         schema:
 *           type: integer
 *           default: 120
 *         description: Duración de la clase en minutos (sólo si no se envía fechaFin)
 *       - in: query
 *         name: alumnos
 *         schema:
 *           type: integer
 *         description: Filtra por capacidad mínima (>= alumnos)
 *     responses:
 *       200:
 *         description: Lista de laboratorios disponibles para el horario
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Laboratorio'
 *       400:
 *         description: Falta fechaHora o fecha inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/disponibles-horario', obtenerLaboratoriosDisponiblesPorHorario);

/**
 * @swagger
 * /laboratorio:
 *   get:
 *     summary: Listar todos los laboratorios (excluye eliminados)
 *     tags: [Laboratorios]
 *     responses:
 *       200:
 *         description: Lista de laboratorios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Laboratorio'
 */
// R: Obtener todos los laboratorios
router.get('/', obtenerLaboratorios);

/**
 * @swagger
 * /laboratorio/edificio/{idEdificio}:
 *   get:
 *     summary: Listar laboratorios de un edificio (con equipos fijos)
 *     description: Incluye los equipos fijos de cada laboratorio (populate).
 *     tags: [Laboratorios]
 *     parameters:
 *       - in: path
 *         name: idEdificio
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del edificio
 *     responses:
 *       200:
 *         description: Lista de laboratorios del edificio
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Laboratorio'
 */
// R: Obtener todos los laboraorios de un edificio específico
router.get('/edificio/:idEdificio', obtenerLaboratoriosPorEdificio);

/**
 * @swagger
 * /laboratorio/{idLaboratorio}:
 *   get:
 *     summary: Obtener un laboratorio por ID
 *     tags: [Laboratorios]
 *     parameters:
 *       - in: path
 *         name: idLaboratorio
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del laboratorio
 *     responses:
 *       200:
 *         description: Laboratorio encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Laboratorio'
 *       404:
 *         description: Laboratorio no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// R: Obtener un laboratorio por su ID
router.get('/:idLaboratorio', obtenerLaboratorioPorId);

/**
 * @swagger
 * /laboratorio/{idLaboratorio}/estado:
 *   patch:
 *     summary: Actualizar el estado de un laboratorio
 *     tags: [Laboratorios]
 *     parameters:
 *       - in: path
 *         name: idLaboratorio
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del laboratorio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LaboratorioEstadoInput'
 *     responses:
 *       200:
 *         description: Estado actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Laboratorio'
 *       400:
 *         description: Estado no válido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Laboratorio no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// U: Actualizar el estado de un laboratorio
router.patch('/:idLaboratorio/estado', actualizarEstadoLaboratorio);

/**
 * @swagger
 * /laboratorio/{idLaboratorio}:
 *   put:
 *     summary: Actualizar un laboratorio
 *     tags: [Laboratorios]
 *     parameters:
 *       - in: path
 *         name: idLaboratorio
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del laboratorio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LaboratorioInput'
 *     responses:
 *       200:
 *         description: Laboratorio actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Laboratorio'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Laboratorio no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// U: Actualizar un laboratorio
router.put('/:idLaboratorio', actualizarLaboratorio);

/**
 * @swagger
 * /laboratorio/{idLaboratorio}:
 *   delete:
 *     summary: Eliminar un laboratorio (borrado lógico)
 *     description: No elimina el documento; marca `estado = "eliminado"`.
 *     tags: [Laboratorios]
 *     parameters:
 *       - in: path
 *         name: idLaboratorio
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del laboratorio
 *     responses:
 *       200:
 *         description: Laboratorio marcado como eliminado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Laboratorio'
 *       404:
 *         description: Laboratorio no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// D: Eliminar un laboratorio (eliminación lógica)
router.delete('/:idLaboratorio', eliminarLaboratorioLogico);

export default router;