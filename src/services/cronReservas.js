import mongoose from "mongoose";
import Reserva from "../models/reserva.model.js";
import Item from "../models/item.model.js";
import Lote from "../models/lote.model.js";
import { soportaTransacciones } from "./aprobacionReserva.js";
import { registrarMovimiento } from "./movimientoStock.service.js";
import { devolverYRegistrar } from "./devolucionReserva.js";

/*
 * Cron de ciclo de vida de reservas.
 * Ver docs/stock-disponibilidad-temporal.md §6, §7, §8, §9.
 *
 * Cada corrida:
 *  1. Promueve Pendiente → En Curso (claim atómico §6) y ejecuta el consumo
 *     físico de consumibles (§7). Si el stock físico no alcanza en la ejecución,
 *     la reserva pasa a 'Conflicto' (§8).
 *  2. Promueve En Curso → Finalizada las reservas cuya ventana terminó (§9).
 *
 * Reutilizables NUNCA ejecutan consumo físico (son puramente temporales, §3.1).
 */

// Error de ejecución: el FIFO no pudo cubrir la cantidad comprometida
// (vencimiento/descarte entre aprobación y ejecución).
export class ConflictoEjecucionError extends Error {
  constructor(itemId, disponible, solicitado) {
    super(
      `No se pudo ejecutar el consumo del item ${itemId}. Disponible físico: ${disponible}, requerido: ${solicitado}.`
    );
    this.name = "ConflictoEjecucionError";
    this.itemId = itemId;
    this.disponible = disponible;
    this.solicitado = solicitado;
  }
}

/*
 * Descuenta físicamente el stock de los materiales CONSUMIBLES de la reserva y
 * reescribe `lotesUsados` con lo realmente consumido (fuente de verdad §2.3).
 *
 * Sobre la desviación de fase 1 (§15.4): en la aprobación `lotesUsados` quedó
 * poblado como PUNTERO sin decrementar. Aquí recalculamos FIFO sobre el stock
 * vigente, decrementamos y SOBRESCRIBIMOS `lotesUsados` (no sumamos encima), de
 * modo que el puntero se convierte en decremento real sin doble conteo.
 *
 * Muta `reserva.materialesReservados[].lotesUsados` en memoria; el caller
 * persiste la reserva.
 */
const ejecutarConsumoFisico = async (reserva, session = null) => {
  const opts = session ? { session } : {};

  for (const mat of reserva.materialesReservados) {
    const item = await Item.findById(mat.itemId).session(session);
    // Reutilizables y consumibles decrementan físico al iniciar (§7). El
    // reutilizable devolverá su stock al finalizar; el consumible solo el
    // sobrante en una finalización manual (§10).
    if (!item) continue;

    // `activo:{ $ne:false }` alinea el consumo FIFO con la definición canónica del
    // agregado (stockFisicoItem): un lote dado de baja lógica (activo:false) puede
    // seguir en estado "disponible" con stock, pero NO debe consumirse ni contarse
    // en `totalFisico` (que es el cantidadAnterior del movimiento APROBACION_RESERVA).
    const query = Lote.find({
      itemId: mat.itemId,
      estado: "disponible",
      activo: { $ne: false },
      cantidadDisponible: { $gt: 0 },
    }).sort({ fechaVencimiento: 1, fechaCreacion: 1 });

    const lotes = await (session ? query.session(session) : query);

    const totalFisico = lotes.reduce((acc, l) => acc + l.cantidadDisponible, 0);
    if (totalFisico < mat.cantidadTotal) {
      throw new ConflictoEjecucionError(
        mat.itemId,
        totalFisico,
        mat.cantidadTotal
      );
    }

    let restante = mat.cantidadTotal;
    const lotesUsados = [];
    for (const lote of lotes) {
      if (restante <= 0) break;
      const usar = Math.min(lote.cantidadDisponible, restante);
      await Lote.updateOne(
        { _id: lote._id },
        { $inc: { cantidadDisponible: -usar } },
        opts
      );
      lotesUsados.push({ loteId: lote._id, cantidad: usar });
      restante -= usar;
    }
    mat.lotesUsados = lotesUsados;
    // A partir de acá `lotesUsados` es un decremento físico REAL (no un puntero):
    // habilita las devoluciones al finalizar (§10).
    mat.consumoEjecutado = true;

    // Movimiento de historial: egreso físico al iniciar la reserva (invariante
    // nueva = anterior - egreso). `totalFisico` es el stock agregado del item
    // ANTES de este egreso. Es un movimiento de sistema (sin usuarioId): lo
    // dispara el cron, no una persona.
    await registrarMovimiento({
      itemId: mat.itemId,
      tipoMovimiento: 'APROBACION_RESERVA',
      cantidad: -mat.cantidadTotal,
      cantidadAnterior: totalFisico,
      cantidadNueva: totalFisico - mat.cantidadTotal,
      reservaId: reserva._id,
      destinoLaboratorioId: reserva.laboratorioId,
      observacion: item.esConsumible
        ? 'Consumo físico al iniciar la reserva'
        : 'Salida de material reutilizable al iniciar la reserva'
    }, session);
  }
};

// Núcleo del §7 ejecutable con o sin session (consumo + persistencia de la
// reserva ya reclamada como 'En Curso').
const consumirYGuardar = async (reserva, session) => {
  await ejecutarConsumoFisico(reserva, session);
  await reserva.save(session ? { session } : undefined);
};

/*
 * Promueve UNA reserva Pendiente cuya ventana ya empezó (§6) y ejecuta su
 * consumo físico (§7). El claim atómico evita doble ejecución entre corridas
 * solapadas. Ante fallo de ejecución marca 'Conflicto' (§8).
 *
 * @returns {'En Curso' | 'Conflicto' | null}  null si otra corrida ya la tomó.
 */
export const promoverReservaAEnCurso = async (reservaId) => {
  // 1. Claim atómico Pendiente → En Curso.
  const reserva = await Reserva.findOneAndUpdate(
    {
      _id: reservaId,
      estado: "Pendiente",
      fechaInicioReal: { $lte: new Date() },
    },
    { $set: { estado: "En Curso" } },
    { new: true }
  );
  if (!reserva) return null; // otra corrida la reclamó (o dejó de aplicar)

  // 2. Consumo físico de consumibles.
  try {
    if (await soportaTransacciones()) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await consumirYGuardar(reserva, session);
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Camino degradado standalone (sin aislamiento transaccional).
      await consumirYGuardar(reserva, null);
    }
    return "En Curso";
  } catch (error) {
    if (error instanceof ConflictoEjecucionError) {
      // §8: la reserva deja de restar disponibilidad hasta resolución manual.
      await Reserva.updateOne(
        { _id: reservaId },
        { $set: { estado: "Conflicto" } }
      );
      notificarPersonal(reservaId, error);
      return "Conflicto";
    }
    throw error;
  }
};

// Notificación a rol PERSONAL (§8). No hay sistema de notificaciones todavía;
// se deja como punto de extensión con log explícito.
const notificarPersonal = (reservaId, error) => {
  console.warn(
    `[cronReservas] Reserva ${reservaId} en Conflicto: ${error.message}`
  );
};

/*
 * Devolución física de materiales REUTILIZABLES al finalizar la reserva (§10): el
 * reutilizable se decrementó al iniciar (§7), así que al cerrarse vuelve el 100%
 * de lo que salió (repone `lotesUsados` + registra DEVOLUCION con `cantidad > 0`).
 * Los consumibles NO se devuelven acá (default "se consumió todo"; el sobrante se
 * repone solo en la finalización manual, ver reservaControllers.finalizarReserva).
 *
 * Evento de sistema (sin usuarioId). Transaccional si la conexión lo soporta;
 * best-effort: un fallo no debe impedir la finalización de las demás reservas.
 */
const devolverReutilizablesAlFinalizar = async (reserva) => {
  const ejecutar = async (session) => {
    for (const mat of reserva.materialesReservados ?? []) {
      const item = await Item.findById(mat.itemId).select("esConsumible").session(session ?? null);
      if (!item || item.esConsumible !== false) continue; // solo reutilizables
      // Sin descuento físico previo, `lotesUsados` es un puntero que nunca salió:
      // devolverlo inyectaría stock fantasma.
      if (mat.consumoEjecutado !== true) continue;
      const total = (mat.lotesUsados ?? []).reduce((acc, l) => acc + l.cantidad, 0);
      if (total <= 0) continue;
      await devolverYRegistrar(reserva, mat, total, {
        session,
        observacion: "Devolución de material reutilizable al finalizar la reserva",
      });
    }
  };

  try {
    if (await soportaTransacciones()) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await ejecutar(session);
        });
      } finally {
        await session.endSession();
      }
    } else {
      await ejecutar(null);
    }
  } catch (error) {
    console.error(
      `[cronReservas] no se pudo devolver los reutilizables de la reserva ${reserva._id}:`,
      error.message
    );
  }
};

/*
 * §9: promueve En Curso → Finalizada las reservas cuya ventana ya terminó, con
 * claim atómico. Al finalizar, devuelve físicamente los materiales reutilizables
 * (§10); los consumibles se dan por consumidos (el sobrante solo vuelve en la
 * finalización manual).
 * @returns {number} cantidad de reservas finalizadas.
 */
export const finalizarReservasVencidas = async () => {
  const vencidas = await Reserva.find({
    estado: "En Curso",
    fechaFinReal: { $lte: new Date() },
  }).select("_id");

  let finalizadas = 0;
  for (const { _id } of vencidas) {
    const claim = await Reserva.findOneAndUpdate(
      { _id, estado: "En Curso", fechaFinReal: { $lte: new Date() } },
      { $set: { estado: "Finalizada" } },
      { new: true }
    );
    if (claim) {
      finalizadas += 1;
      await devolverReutilizablesAlFinalizar(claim);
    }
  }
  return finalizadas;
};

/*
 * Una corrida completa del cron. Devuelve un resumen para logging.
 */
export const correrCronReservas = async () => {
  const resumen = { promovidas: 0, conflictos: 0, finalizadas: 0 };

  // Promociones a En Curso + consumo físico.
  const aIniciar = await Reserva.find({
    estado: "Pendiente",
    fechaInicioReal: { $lte: new Date() },
  }).select("_id");

  for (const { _id } of aIniciar) {
    const resultado = await promoverReservaAEnCurso(_id);
    if (resultado === "En Curso") resumen.promovidas += 1;
    else if (resultado === "Conflicto") resumen.conflictos += 1;
  }

  // Finalizaciones automáticas.
  resumen.finalizadas = await finalizarReservasVencidas();

  return resumen;
};

let _intervalId = null;

/*
 * Arranca el cron periódico (por defecto cada minuto, §6). Idempotente: no crea
 * un segundo intervalo si ya está corriendo. Cada corrida loguea su resumen.
 */
export const iniciarCronReservas = (intervalMs = 60_000) => {
  if (_intervalId) return _intervalId;
  _intervalId = setInterval(async () => {
    try {
      const resumen = await correrCronReservas();
      if (resumen.promovidas || resumen.conflictos || resumen.finalizadas) {
        console.log("[cronReservas] corrida:", resumen);
      }
    } catch (error) {
      console.error("[cronReservas] error en corrida:", error.message);
    }
  }, intervalMs);
  // No mantener vivo el proceso solo por el cron.
  if (typeof _intervalId.unref === "function") _intervalId.unref();
  return _intervalId;
};

export const detenerCronReservas = () => {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
};
