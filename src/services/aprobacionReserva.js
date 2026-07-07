import mongoose from "mongoose";
import Item from "../models/item.model.js";
import Lote from "../models/lote.model.js";
import Reserva from "../models/reserva.model.js";
import { calcularDisponibilidad } from "./disponibilidad.js";

/*
 * Aprobación de pedido con creación de Reserva, sin write skew.
 * Ver docs/stock-disponibilidad-temporal.md §5.
 *
 * Estrategia: dentro de una transacción se fuerza una colisión write-write
 * sobre Item.version ($inc), de modo que dos aprobaciones del mismo item
 * entren en conflicto y el motor aborte una; withTransaction la reintenta con
 * datos frescos.
 *
 * NOTA DE INFRAESTRUCTURA (deuda documentada): el anti-write-skew requiere que
 * MongoDB corra como replica set. Mientras el entorno sea standalone, se degrada
 * a un camino NO transaccional (misma lógica, sin garantía de aislamiento). El
 * gate de disponibilidad sigue funcionando; lo que se pierde es la protección
 * contra dos aprobaciones simultáneas del mismo item. Ver §5.1.
 */

export class ConflictoStockError extends Error {
  constructor(itemId, disponible, solicitado) {
    super(
      `Stock insuficiente para el item ${itemId}. Disponible: ${disponible}, solicitado: ${solicitado}.`
    );
    this.name = "ConflictoStockError";
    this.itemId = itemId;
    this.disponible = disponible;
    this.solicitado = solicitado;
  }
}

// Detecta (y cachea) si la conexión soporta transacciones multi-documento,
// es decir, si es miembro de un replica set / mongos.
let _soportaTransacciones = null;
export const soportaTransacciones = async () => {
  if (_soportaTransacciones !== null) return _soportaTransacciones;
  try {
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    _soportaTransacciones = Boolean(info.setName || info.msg === "isdbgrid");
  } catch {
    _soportaTransacciones = false;
  }
  return _soportaTransacciones;
};

/*
 * Asigna lotes FIFO (vencimiento, luego creación) como PUNTEROS, sin decrementar
 * cantidadDisponible. Esto mantiene la trazabilidad que necesita el flujo de
 * descartes (services/descarte.service.js lee materialesReservados.lotesUsados)
 * sin violar el invariante de "no decrementar en la aprobación" (§3.1: se
 * permite poblar como puntero sin decrementar cantidad).
 */
export const asignarLotesFIFO = async (itemId, cantidad, session = null) => {
  const lotesUsados = [];
  let restante = cantidad;

  const query = Lote.find({
    itemId,
    estado: "disponible",
    cantidadDisponible: { $gt: 0 },
  }).sort({ fechaVencimiento: 1, fechaCreacion: 1 });

  const lotes = await (session ? query.session(session) : query);

  for (const lote of lotes) {
    if (restante <= 0) break;
    const usar = Math.min(lote.cantidadDisponible, restante);
    lotesUsados.push({ loteId: lote._id, cantidad: usar });
    restante -= usar;
  }
  return lotesUsados;
};

// Operaciones núcleo, ejecutables con o sin session.
const ejecutar = async ({ datosReserva, materiales, inicio, fin }, session) => {
  const opts = session ? { session } : {};

  // 1. Colisión intencional: bloquea a cualquier otra aprobación del mismo item.
  for (const m of materiales) {
    await Item.updateOne({ _id: m.itemId }, { $inc: { version: 1 } }, opts);
  }

  // 2. Recalcular disponibilidad ya "dueños" del lock lógico.
  for (const m of materiales) {
    const disp = await calcularDisponibilidad(m.itemId, inicio, fin, session);
    if (disp < m.cantidadTotal) {
      throw new ConflictoStockError(m.itemId, disp, m.cantidadTotal);
    }
  }

  // 3. Crear la Reserva (lotesUsados ya vienen como punteros FIFO).
  const [reserva] = await Reserva.create([datosReserva], opts);
  return reserva;
};

/**
 * @param {Object} params
 * @param {Object} params.datosReserva  documento de Reserva a crear
 * @param {Array}  params.materiales    [{ itemId, cantidadTotal, lotesUsados }]
 * @param {Date}   params.inicio        inicio de la ventana del pedido
 * @param {Date}   params.fin           fin de la ventana del pedido
 * @returns {Promise<Reserva>}
 * @throws  {ConflictoStockError} si algún material no tiene disponibilidad
 */
export const aprobarConReserva = async (params) => {
  if (!(await soportaTransacciones())) {
    // Camino degradado standalone (sin anti-write-skew).
    return ejecutar(params, null);
  }

  const session = await mongoose.startSession();
  try {
    let reserva;
    await session.withTransaction(async () => {
      reserva = await ejecutar(params, session);
    });
    return reserva;
  } finally {
    await session.endSession();
  }
};
