import mongoose from "mongoose";
import Item from "../models/item.model.js";
import Lote from "../models/lote.model.js";
import Reserva from "../models/reserva.model.js";

/*
 * Cálculo de disponibilidad de stock por rango horario.
 * Ver docs/stock-disponibilidad-temporal.md §3.
 *
 * Bifurca según item.esConsumible:
 *  - Reutilizable (esConsumible = false): puro temporal (solapamiento de ventanas).
 *  - Consumible   (esConsumible = true):  pool finito, consumo acumulado hasta finVentana.
 *
 * Invariante clave: NUNCA se lee/escribe cantidad "de ahora" decrementando lotes;
 * el stock físico solo se decrementa al ejecutar el consumo de consumibles (§7),
 * fuera de este servicio.
 */

const conSession = (aggregate, session) =>
  session ? aggregate.session(session) : aggregate;

// SUM(lotes.cantidadDisponible) WHERE estado='disponible' AND activo≠false.
// Idéntico a Lote.calcularStockDisponible pero admite session.
const stockFisicoNominal = async (oid, session) => {
  const agg = await conSession(
    Lote.aggregate([
      {
        $match: {
          itemId: oid,
          estado: "disponible",
          activo: { $ne: false },
        },
      },
      { $group: { _id: "$itemId", total: { $sum: "$cantidadDisponible" } } },
    ]),
    session
  );
  return agg.length > 0 ? agg[0].total : 0;
};

export const calcularDisponibilidad = async (
  itemId,
  inicioVentana,
  finVentana,
  session = null,
  // El caller puede pasar el Item ya cargado para evitar una lectura redundante.
  itemPreCargado = null
) => {
  const item = itemPreCargado ?? (await Item.findById(itemId).session(session));
  if (!item) return 0;

  const oid = new mongoose.Types.ObjectId(itemId);
  const stockTotal = await stockFisicoNominal(oid, session);

  if (item.esConsumible === false) {
    // ----- Reutilizable: puro temporal (solapamiento) -----
    // reservadoEnVentana = SUM(cantidadTotal) de reservas activas cuya ventana
    // solapa [inicioVentana, finVentana]. capacidadNominalTotal es estable
    // porque nadie decrementa el lote.
    const agg = await conSession(
      Reserva.aggregate([
        {
          $match: {
            estado: { $in: ["Pendiente", "En Curso"] },
            fechaInicioReal: { $lt: finVentana },
            fechaFinReal: { $gt: inicioVentana },
          },
        },
        { $unwind: "$materialesReservados" },
        { $match: { "materialesReservados.itemId": oid } },
        {
          $group: {
            _id: null,
            total: { $sum: "$materialesReservados.cantidadTotal" },
          },
        },
      ]),
      session
    );
    const reservado = agg.length > 0 ? agg[0].total : 0;
    return stockTotal - reservado;
  }

  // ----- Consumible: pool finito global (consumo acumulado) -----
  // Solo cuentan las 'Pendiente' que consumen antes o durante la ventana. Las
  // 'En Curso'/'Finalizada' ya descontaron físicamente y salen de stockTotal
  // (sin doble conteo).
  const agg = await conSession(
    Reserva.aggregate([
      {
        $match: {
          estado: "Pendiente",
          fechaInicioReal: { $lt: finVentana },
        },
      },
      { $unwind: "$materialesReservados" },
      { $match: { "materialesReservados.itemId": oid } },
      {
        $group: {
          _id: null,
          total: { $sum: "$materialesReservados.cantidadTotal" },
        },
      },
    ]),
    session
  );
  const reservadoAcumulado = agg.length > 0 ? agg[0].total : 0;
  return stockTotal - reservadoAcumulado;
};

// -----------------------------------------------------------------------------
// Vista de gestión de stock (docs/stock-disponibilidad-temporal.md §14)
// -----------------------------------------------------------------------------

// Stock físico instalado: existencia real, excluye 'descartado' e inactivos.
// Distinto de stockFisicoNominal, que solo mira 'disponible'.
const stockFisicoTotal = async (oid, session) => {
  const agg = await conSession(
    Lote.aggregate([
      {
        $match: {
          itemId: oid,
          estado: { $ne: "descartado" },
          activo: { $ne: false },
        },
      },
      { $group: { _id: "$itemId", total: { $sum: "$cantidadDisponible" } } },
    ]),
    session
  );
  return agg.length > 0 ? agg[0].total : 0;
};

// Reservas de un estado dado, desglosadas por reserva para poder decir "para qué
// día/horario". Reutiliza el índice §12.
//   - acotarPorFin=true  → solapamiento estricto de ventana (fechaFinReal > inicio).
//   - acotarPorFin=false → criterio acumulado (solo fechaInicioReal < fin), igual
//     que calcularDisponibilidad para consumibles: una reserva que consume antes
//     de la ventana igualmente depleta el pool, así que debe listarse.
const reservasEnVentana = async (
  oid,
  estado,
  inicio,
  fin,
  session,
  acotarPorFin = true
) => {
  const match = {
    estado,
    fechaInicioReal: { $lt: fin },
  };
  if (acotarPorFin) {
    match.fechaFinReal = { $gt: inicio };
  }
  return conSession(
    Reserva.aggregate([
      { $match: match },
      { $unwind: "$materialesReservados" },
      { $match: { "materialesReservados.itemId": oid } },
      {
        $project: {
          _id: 0,
          cantidad: "$materialesReservados.cantidadTotal",
          fechaInicioReal: 1,
          fechaFinReal: 1,
          pedidoId: 1,
        },
      },
    ]),
    session
  );
};

/*
 * Devuelve las cuatro magnitudes de la vista de stock para un item en una
 * ventana [desde, hasta] (§14):
 *  - total:      stock físico instalado (existencia real)
 *  - disponible: lo reservable en la ventana (calcularDisponibilidad, §3)
 *  - aceptado:   reservas 'Pendiente' que pesan sobre la ventana, por reserva
 *  - enUso:      reservas 'En Curso' que solapan, desglosadas por reserva
 *
 * 'aceptado' usa el MISMO criterio que 'disponible' según el tipo de item, de
 * modo que las magnitudes reconcilien (disponible + Σaceptado [+ ΣenUso para
 * reutilizables] = total):
 *  - Reutilizable: solapamiento estricto (temporal).
 *  - Consumible:   acumulado (una reserva que consume antes de la ventana
 *                  igualmente depleta el pool y debe listarse).
 */
export const desgloseStock = async (itemId, desde, hasta, session = null) => {
  const item = await Item.findById(itemId).session(session);
  if (!item) return { total: 0, disponible: 0, aceptado: [], enUso: [] };

  const oid = new mongoose.Types.ObjectId(itemId);
  const esConsumible = item.esConsumible === true;

  const [total, disponible, aceptado, enUso] = await Promise.all([
    stockFisicoTotal(oid, session),
    calcularDisponibilidad(itemId, desde, hasta, session),
    // Consumible → acumulado (acotarPorFin=false); reutilizable → solapamiento.
    reservasEnVentana(oid, "Pendiente", desde, hasta, session, !esConsumible),
    reservasEnVentana(oid, "En Curso", desde, hasta, session),
  ]);
  return { total, disponible, aceptado, enUso };
};
