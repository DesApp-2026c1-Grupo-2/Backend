import { Router } from 'express';
const router = Router();

import {
  createLote,
  getLotes,
  getLoteById,
  updateLote,
  transferirLote,
  deleteLote
} from '../controllers/loteControllers.js';
import { validarJWT, validarRol } from '../middlewares/validateJWT.js';
import { validate } from '../middlewares/validator.middleware.js';
import { transferirLoteSchema } from '../schemas/loteSchema.js';

// Rutas CRUD para Lotes

/**
 * @swagger
 * /lotes:
 *   get:
 *     summary: Listar lotes (ordenados FEFO)
 *     description: >-
 *       Devuelve un array por defecto. Si se envía `page` o `limit`, devuelve un
 *       objeto paginado `{ total, page, limit, lotes }`. El item viene reshaped
 *       a { id, nombre, codigo, tipo }.
 *     tags: [Lotes]
 *     parameters:
 *       - in: query
 *         name: itemId
 *         schema:
 *           type: string
 *         description: Filtra por item
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [disponible, descartado]
 *         description: Filtra por estado
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Activa el modo paginado
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           maximum: 100
 *         description: Activa el modo paginado
 *     responses:
 *       200:
 *         description: Lista de lotes (array) u objeto paginado
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: array
 *                   items:
 *                     $ref: '#/components/schemas/Lote'
 *                 - type: object
 *                   properties:
 *                     total: { type: integer, example: 40 }
 *                     page: { type: integer, example: 1 }
 *                     limit: { type: integer, example: 20 }
 *                     lotes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Lote'
 */
router.get('/', getLotes);

/**
 * @swagger
 * /lotes/{id}:
 *   get:
 *     summary: Obtener un lote por ID
 *     tags: [Lotes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del lote
 *     responses:
 *       200:
 *         description: Lote encontrado (con item populado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lote'
 *       404:
 *         description: Lote no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', getLoteById);

/**
 * @swagger
 * /lotes:
 *   post:
 *     summary: Crear un nuevo lote
 *     description: >-
 *       Un lote que nace disponible con cantidad > 0 registra un movimiento de
 *       stock de tipo COMPRA.
 *     tags: [Lotes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoteInput'
 *     responses:
 *       201:
 *         description: Lote creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lote'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', createLote);

/**
 * @swagger
 * /lotes/{id}:
 *   put:
 *     summary: Actualizar un lote
 *     description: >-
 *       Los cambios que afectan el stock físico agregado (ajuste de cantidad o
 *       transición disponible↔descartado) registran un movimiento
 *       (AJUSTE_MANUAL o BAJA).
 *     tags: [Lotes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del lote
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoteInput'
 *     responses:
 *       200:
 *         description: Lote actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lote'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Lote no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', updateLote);

/**
 * @swagger
 * /lotes/{id}/transferir:
 *   post:
 *     summary: Transferir o devolver un lote entre depósito y laboratorios
 *     description: >-
 *       Mueve un lote de ubicación (o lo devuelve al depósito con
 *       laboratorioDestinoId=null). Con `cantidad` menor a la disponible es una
 *       transferencia parcial (crea un lote nuevo en el destino). El stock
 *       físico agregado del item no cambia. Requiere rol PERSONAL o ADMIN.
 *     tags: [Lotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del lote a transferir
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransferirLoteInput'
 *     responses:
 *       200:
 *         description: Lote transferido (se devuelve el lote resultante)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lote'
 *       400:
 *         description: >-
 *           Datos inválidos, cantidad mayor a la disponible, transferencia
 *           parcial de un lote no disponible, o lote ya en el destino
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
 *         description: Lote no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Transferir/devolver un lote entre depósito y laboratorios. Operación de inventario
// gestionada por PERSONAL/ADMIN (a diferencia del CRUD, que hoy no está gateado).
router.post(
  '/:id/transferir',
  validarJWT,
  validarRol('PERSONAL', 'ADMIN'),
  validate(transferirLoteSchema),
  transferirLote
);

/**
 * @swagger
 * /lotes/{id}:
 *   delete:
 *     summary: Eliminar un lote (borrado lógico)
 *     description: >-
 *       No elimina el documento; marca `activo = false`. Si el lote estaba
 *       disponible con cantidad > 0, registra un movimiento de tipo BAJA.
 *     tags: [Lotes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del lote
 *     responses:
 *       200:
 *         description: Lote marcado como eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Lote marcado como eliminado (borrado lógico)
 *                 lote:
 *                   $ref: '#/components/schemas/Lote'
 *       404:
 *         description: Lote no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', deleteLote);

export default router;
