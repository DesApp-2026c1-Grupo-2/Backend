import { Router } from "express";
const router = Router()

import { validate } from '../middlewares/validator.middleware.js';
import { validarJWT, validarRol } from '../middlewares/validateJWT.js';
import {
    createEquipoSchema,
    updateEquipoSchema,
    equipoIdParamSchema,
    equipoQuerySchema,
    estadisticasUsoQuerySchema
} from "../schemas/equipoSchema.js";
import {
    registrarMantenimientoSchema,
    finalizarMantenimientoSchema,
    historialMantenimientoQuerySchema
} from "../schemas/historialMantenimientoSchema.js";

import {deleteEquipo,
    updateEquipo,
    getEquipoById,
    getEquipos,
    createEquipo,
    getEstadisticasUso } from '../controllers/equipoControllers.js';
import {
    registrarMantenimiento,
    finalizarMantenimiento,
    getHistorialMantenimiento
} from '../controllers/historialMantenimientoControllers.js';

// Lecturas: cualquier usuario autenticado. Mutaciones y estadísticas: PERSONAL/ADMIN.

/**
 * @swagger
 * /equipo:
 *   post:
 *     summary: Crear un nuevo equipo
 *     description: Requiere rol PERSONAL o ADMIN.
 *     tags: [Equipos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EquipoInput'
 *     responses:
 *       201:
 *         description: Equipo creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Equipo'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol PERSONAL/ADMIN
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: El código de equipo ya existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", validarJWT, validarRol('PERSONAL', 'ADMIN'), validate(createEquipoSchema, 'body'), createEquipo);

/**
 * @swagger
 * /equipo:
 *   get:
 *     summary: Listar equipos (con búsqueda y paginación)
 *     tags: [Equipos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [disponible, mantenimiento, fuera de servicio]
 *         description: Filtra por estado
 *       - in: query
 *         name: edificioId
 *         schema:
 *           type: string
 *         description: ObjectId del edificio, o "null" para equipos sin edificio
 *       - in: query
 *         name: laboratorioId
 *         schema:
 *           type: string
 *         description: ObjectId del laboratorio, o "null" para equipos sin laboratorio
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Búsqueda parcial (case-insensitive) sobre nombre o código
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Cantidad de resultados por página
 *     responses:
 *       200:
 *         description: Lista paginada de equipos (con edificio y laboratorio populados)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 12
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 20
 *                 equipos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Equipo'
 *       400:
 *         description: Formato de ID inválido en los parámetros
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", validarJWT, validate(equipoQuerySchema, 'query'), getEquipos);

/**
 * @swagger
 * /equipo/estadisticas-uso:
 *   get:
 *     summary: Ranking de uso de equipos (reservas finalizadas)
 *     description: >-
 *       Cuenta los usos (reservas Finalizadas) por equipo dentro del período
 *       indicado y los ordena de mayor a menor. Requiere rol PERSONAL o ADMIN.
 *     tags: [Equipos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [dia, semana, mes]
 *           default: semana
 *         description: Período que contiene la fecha de referencia
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha de referencia (ISO). Por defecto, ahora.
 *       - in: query
 *         name: laboratorioId
 *         schema:
 *           type: string
 *         description: Filtra por laboratorio donde ocurrió la reserva
 *       - in: query
 *         name: equipoId
 *         schema:
 *           type: string
 *         description: Restringe a un solo equipo
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Ranking de uso paginado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 periodo:
 *                   type: string
 *                   example: semana
 *                 desde:
 *                   type: string
 *                   format: date-time
 *                 hasta:
 *                   type: string
 *                   format: date-time
 *                 paginacion:
 *                   type: object
 *                   properties:
 *                     page: { type: integer, example: 1 }
 *                     limit: { type: integer, example: 10 }
 *                     total: { type: integer, example: 5 }
 *                     totalPaginas: { type: integer, example: 1 }
 *                 equipos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       equipoId: { type: string, example: '665f1a2b3c4d5e6f7a8b9c0d' }
 *                       usos: { type: integer, example: 8 }
 *                       nombre: { type: string, example: 'Microscopio óptico' }
 *                       codigo: { type: string, example: 'MIC-001' }
 *                       tipo: { type: string, example: 'microscopio' }
 *                       estado: { type: string, example: 'disponible' }
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol PERSONAL/ADMIN
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/estadisticas-uso", validarJWT, validarRol('PERSONAL', 'ADMIN'), validate(estadisticasUsoQuerySchema, 'query'), getEstadisticasUso);

// Historial de mantenimiento (sub-recurso del equipo)

/**
 * @swagger
 * /equipo/{id}/mantenimientos:
 *   post:
 *     summary: Registrar un mantenimiento y poner el equipo en mantenimiento
 *     description: >-
 *       Crea un registro de historial y pasa el equipo a estado
 *       "mantenimiento". El responsable se toma del JWT. Requiere rol
 *       PERSONAL o ADMIN.
 *     tags: [Equipos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del equipo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MantenimientoInput'
 *     responses:
 *       201:
 *         description: Mantenimiento registrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Mantenimiento registrado y equipo puesto en mantenimiento
 *                 equipo:
 *                   $ref: '#/components/schemas/Equipo'
 *                 mantenimiento:
 *                   $ref: '#/components/schemas/HistorialMantenimiento'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol PERSONAL/ADMIN
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Equipo no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: El equipo ya está en mantenimiento o fuera de servicio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/:id/mantenimientos", validarJWT, validarRol('PERSONAL', 'ADMIN'), validate(equipoIdParamSchema, 'params'), validate(registrarMantenimientoSchema, 'body'), registrarMantenimiento);

/**
 * @swagger
 * /equipo/{id}/mantenimientos/finalizar:
 *   patch:
 *     summary: Finalizar el mantenimiento abierto y volver a disponible
 *     description: >-
 *       Cierra el mantenimiento abierto (fija su fecha de fin en el servidor) y
 *       devuelve el equipo a "disponible". El body se ignora. Requiere rol
 *       PERSONAL o ADMIN.
 *     tags: [Equipos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del equipo
 *     responses:
 *       200:
 *         description: Mantenimiento finalizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Mantenimiento finalizado y equipo puesto en disponible
 *                 equipo:
 *                   $ref: '#/components/schemas/Equipo'
 *                 mantenimiento:
 *                   $ref: '#/components/schemas/HistorialMantenimiento'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol PERSONAL/ADMIN
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Equipo no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: El equipo no está en mantenimiento o no hay uno abierto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/:id/mantenimientos/finalizar", validarJWT, validarRol('PERSONAL', 'ADMIN'), validate(equipoIdParamSchema, 'params'), validate(finalizarMantenimientoSchema, 'body'), finalizarMantenimiento);

/**
 * @swagger
 * /equipo/{id}/mantenimientos:
 *   get:
 *     summary: Listar el historial de mantenimiento de un equipo (paginado)
 *     tags: [Equipos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del equipo
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [preventivo, correctivo]
 *         description: Filtra por tipo de mantenimiento
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Historial paginado (con responsable populado)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paginacion:
 *                   type: object
 *                   properties:
 *                     page: { type: integer, example: 1 }
 *                     limit: { type: integer, example: 10 }
 *                     total: { type: integer, example: 3 }
 *                     totalPaginas: { type: integer, example: 1 }
 *                 registros:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HistorialMantenimiento'
 *       400:
 *         description: Formato de ID inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id/mantenimientos", validarJWT, validate(equipoIdParamSchema, 'params'), validate(historialMantenimientoQuerySchema, 'query'), getHistorialMantenimiento);

/**
 * @swagger
 * /equipo/{id}:
 *   get:
 *     summary: Obtener un equipo por ID
 *     tags: [Equipos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del equipo
 *     responses:
 *       200:
 *         description: Equipo encontrado (con edificio y laboratorio populados)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Equipo'
 *       400:
 *         description: Formato de ID inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Equipo no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id", validarJWT, validate(equipoIdParamSchema, 'params'), getEquipoById);

/**
 * @swagger
 * /equipo/{id}:
 *   put:
 *     summary: Actualizar un equipo
 *     description: Requiere rol PERSONAL o ADMIN.
 *     tags: [Equipos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del equipo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EquipoUpdateInput'
 *     responses:
 *       200:
 *         description: Equipo actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Equipo'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol PERSONAL/ADMIN
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Equipo no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: El código de equipo ya existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put("/:id", validarJWT, validarRol('PERSONAL', 'ADMIN'), validate(equipoIdParamSchema, 'params'), validate(updateEquipoSchema, 'body'), updateEquipo);

/**
 * @swagger
 * /equipo/{id}:
 *   delete:
 *     summary: Eliminar un equipo (borrado lógico)
 *     description: No elimina el documento; marca `activo = false`. Requiere rol PERSONAL o ADMIN.
 *     tags: [Equipos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del equipo
 *     responses:
 *       200:
 *         description: Equipo marcado como eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Equipo marcado como eliminado (borrado lógico)
 *                 equipo:
 *                   $ref: '#/components/schemas/Equipo'
 *       400:
 *         description: Formato de ID inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El usuario no tiene rol PERSONAL/ADMIN
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Equipo no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete("/:id", validarJWT, validarRol('PERSONAL', 'ADMIN'), validate(equipoIdParamSchema, 'params'), deleteEquipo);

export default router;