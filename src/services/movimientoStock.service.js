import mongoose from "mongoose";
import MovimientoStock from "../models/movimientoStock.model.js";
import Lote from "../models/lote.model.js";

/*
 * Servicio de historial de movimientos de stock.
 * Ver docs/Diseno_Historial_Movimientos_Stock.md.
 *
 * Se invoca DESDE DENTRO de las transacciones existentes (aprobación/consumo,
 * descarte) para que el registro del movimiento sea atómico con el cambio físico
 * del stock. El CRUD de lotes no es transaccional hoy, por lo que allí el
 * registro es best-effort (ver loteControllers.js).
 */

/*
 * Stock físico agregado de un item: suma de `cantidadDisponible` de sus lotes
 * `disponible` y `activo≠false`. Es la misma definición que
 * Lote.calcularStockDisponible, pero aceptando `session` para poder leer el
 * estado consistente dentro de una transacción.
 */
export const stockFisicoItem = async (itemId, session = null) => {
  const pipeline = [
    {
      $match: {
        itemId: new mongoose.Types.ObjectId(itemId),
        estado: 'disponible',
        activo: { $ne: false }
      }
    },
    { $group: { _id: '$itemId', total: { $sum: '$cantidadDisponible' } } }
  ];
  const agg = Lote.aggregate(pipeline);
  const resultado = await (session ? agg.session(session) : agg);
  return resultado.length > 0 ? resultado[0].total : 0;
};

/*
 * Inserta un MovimientoStock. `datos` debe traer al menos itemId, tipoMovimiento,
 * cantidad (signada), cantidadAnterior y cantidadNueva. Devuelve el documento.
 *
 * Usa Model.create([...], { session }) para respetar la sesión/transacción del
 * caller (misma convención que aprobacionReserva.js / cronReservas.js).
 */
export const registrarMovimiento = async (datos, session = null) => {
  const opts = session ? { session } : {};
  const [movimiento] = await MovimientoStock.create([datos], opts);
  return movimiento;
};
