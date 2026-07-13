import Lote from "../models/lote.model.js";
import Item from "../models/item.model.js";
import { registrarMovimiento, stockFisicoItem } from "./movimientoStock.service.js";

/*
 * Devoluciones de stock físico de una reserva a sus lotes de origen.
 *
 * Con el modelo de decremento físico (docs/stock-disponibilidad-temporal.md §7/§10),
 * tanto consumibles como reutilizables decrementan `Lote.cantidadDisponible` al pasar a
 * "En Curso". Estas devoluciones reponen ese stock en tres situaciones que comparten
 * mecánica:
 *   - reutilizable al FINALIZAR la reserva (vuelve el 100%),
 *   - sobrante de consumible al finalizar manualmente (reservado − consumido),
 *   - cancelación de una reserva En Curso (vuelve el 100%).
 */

/*
 * Repone `cantidad` física de un material a los lotes de `material.lotesUsados`,
 * incrementando `cantidadDisponible`. Recorre `lotesUsados` en orden INVERSO al FIFO:
 * se devuelve primero lo asignado a los últimos lotes, de modo que lo que queda
 * "consumido" sea lo que vence antes (coherente con FEFO).
 *
 * No registra el movimiento ni muta el estado de la reserva. Devuelve el detalle
 * repuesto [{ loteId, cantidad }] para que el caller ajuste lotesUsados/traza.
 */
export const devolverMaterialALotes = async (material, cantidad, { session = null } = {}) => {
  const opts = session ? { session } : {};
  const repuesto = [];
  let restante = cantidad;

  const lotesUsados = material.lotesUsados ?? [];
  for (let i = lotesUsados.length - 1; i >= 0 && restante > 0; i--) {
    const lu = lotesUsados[i];
    const devolver = Math.min(lu.cantidad, restante);
    if (devolver <= 0) continue;
    await Lote.updateOne({ _id: lu.loteId }, { $inc: { cantidadDisponible: devolver } }, opts);
    repuesto.push({ loteId: lu.loteId, cantidad: devolver });
    restante -= devolver;
  }
  return repuesto;
};

/*
 * Repone `cantidad` a los lotes del material y registra el MovimientoStock DEVOLUCION
 * correspondiente (ingreso real, `cantidad > 0`), con la foto del stock agregado
 * antes/después. Devuelve el detalle repuesto por lote (para ajustar lotesUsados).
 *
 * Opciones:
 *  - session: participa en la transacción del caller (consumo/finalización); si es null
 *    corre degradado (p. ej. cancelación, que no es transaccional).
 *  - usuarioId: si se pasa, el movimiento queda atribuido; si se omite es evento de
 *    sistema (el cron de finalización).
 *  - observacion: texto del movimiento.
 */
export const devolverYRegistrar = async (
  reserva,
  material,
  cantidad,
  { session = null, usuarioId = null, observacion } = {}
) => {
  if (cantidad <= 0) return [];

  const stockAntes = await stockFisicoItem(material.itemId, session);
  const repuesto = await devolverMaterialALotes(material, cantidad, { session });
  const stockDespues = await stockFisicoItem(material.itemId, session);

  const datos = {
    itemId: material.itemId,
    tipoMovimiento: "DEVOLUCION",
    cantidad,
    cantidadAnterior: stockAntes,
    cantidadNueva: stockDespues,
    reservaId: reserva._id,
    origenLaboratorioId: reserva.laboratorioId,
    observacion,
  };
  if (usuarioId) datos.usuarioId = usuarioId;

  await registrarMovimiento(datos, session);
  return repuesto;
};

/*
 * Aplica las devoluciones de stock al FINALIZAR una reserva (manual, sea vía
 * reservas/finalizar o pedidos/finalizar). Por cada material:
 *   - reutilizable → vuelve el 100% de lo decrementado al iniciar,
 *   - consumible   → vuelve el sobrante (decrementado − consumido reportado).
 * Registra el MovimientoStock DEVOLUCION por cada reposición y ajusta
 * `lotesUsados`/`cantidadConsumidaReal` para que la traza refleje el consumo real.
 *
 * MUTA `reserva.materialesReservados` en memoria; NO hace el claim de estado ni el
 * `save` (eso queda en el caller, que maneja su propia transacción/guarda).
 *
 * `consumos`: [{ itemId, cantidadConsumida }] — items omitidos se dan por
 * consumidos en su totalidad. El consumido se clampa a lo decrementado (no se
 * puede consumir más de lo que salió).
 */
export const aplicarDevolucionesFinalizacion = async (
  reserva,
  { consumos = [], usuarioId = null, session = null } = {}
) => {
  const consumoPorItem = new Map(
    consumos.map((c) => [String(c.itemId), c.cantidadConsumida])
  );

  for (const material of reserva.materialesReservados) {
    const item = await Item.findById(material.itemId)
      .select("esConsumible")
      .session(session ?? null);
    const decrementado = (material.lotesUsados ?? []).reduce((acc, l) => acc + l.cantidad, 0);
    if (decrementado <= 0) continue;

    const esReutilizable = item && item.esConsumible === false;
    let aDevolver;
    if (esReutilizable) {
      aDevolver = decrementado; // el reutilizable vuelve completo
    } else {
      const reportado = consumoPorItem.get(String(material.itemId));
      const consumido = Math.min(reportado ?? decrementado, decrementado);
      material.cantidadConsumidaReal = consumido;
      aDevolver = decrementado - consumido;
    }
    if (aDevolver <= 0) continue;

    const repuesto = await devolverYRegistrar(reserva, material, aDevolver, {
      session,
      usuarioId,
      observacion: esReutilizable
        ? "Devolución de material reutilizable al finalizar la reserva"
        : "Devolución de consumible no utilizado al finalizar la reserva",
    });
    // Ajustar lotesUsados a lo realmente consumido (mismo orden inverso al FIFO
    // que usó la devolución), para que la traza refleje el consumo real.
    for (const r of repuesto) {
      const lu = material.lotesUsados.find((l) => String(l.loteId) === String(r.loteId));
      if (lu) lu.cantidad -= r.cantidad;
    }
    material.lotesUsados = material.lotesUsados.filter((l) => l.cantidad > 0);
  }
};
