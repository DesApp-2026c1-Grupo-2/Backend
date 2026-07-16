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
 * Idempotente: cada material procesado queda marcado `liquidado` y las corridas
 * siguientes lo saltean. Eso permite invocarla sobre una reserva que el cron ya
 * cerró (devolvió sus reutilizables y los marcó) sin devolverlos por segunda vez,
 * recuperando igual el sobrante de los consumibles, que el cron deja pendientes.
 *
 * `consumos`: [{ itemId, cantidadConsumida }] — el gate exige que vengan todos los
 * consumibles sin liquidar. El consumido se clampa a lo decrementado (no se puede
 * consumir más de lo que salió).
 */
/*
 * Predicado del gate: ¿este material exige que se reporte su consumo real?
 *
 * Fuente única de verdad, compartida por `validarConsumosRequeridos` (que tira el
 * 400) y por el endpoint GET /reservas/pedido/:pedidoId (que le dice al front qué
 * preguntar). Van juntos a propósito: si divergieran, el front pediría una cosa y
 * el backend exigiría otra.
 *
 * Depende SOLO del dato físico, nunca del estado de la reserva: el estado lo mueve
 * un cron cada minuto, así que atarse a él hacía que el mismo pedido exigiera el
 * consumo o no según el minuto en que se apretara "Finalizar".
 */
export const requiereConsumoReportado = (material, item) =>
  material?.consumoEjecutado === true && // salió stock físico
  material?.liquidado !== true &&        // y todavía no se saldó
  item?.esConsumible === true;           // los reutilizables vuelven completos

/*
 * Regla de negocio: al finalizar, TODO consumible cuyo descuento físico ya se
 * ejecutó (§7) y siga sin liquidar debe reportar su consumo real. No se admite el
 * default "se consumió todo": el operador tiene que indicar cuánto se usó de cada
 * consumible (0 si no se usó nada, y así vuelve el 100% del sobrante).
 *
 * Los reutilizables NO requieren consumo (vuelven completos). Los materiales sin
 * `consumoEjecutado` tampoco (no salió stock, no hay nada que reportar), ni los ya
 * liquidados (el cron o una finalización previa ya los saldó).
 *
 * Lanza un Error con `status: 400` si falta el consumo de algún consumible.
 */
export const validarConsumosRequeridos = async (
  reserva,
  consumos = [],
  { session = null } = {}
) => {
  // `Number.isFinite` y no `typeof === "number"`: NaN es un number y colaba como
  // reporte válido. Joi ya coacciona/rechaza en la ruta HTTP, pero este servicio
  // también se llama desde otros contextos.
  const reportados = new Set(
    consumos
      .filter((c) => c?.itemId && Number.isFinite(c.cantidadConsumida))
      .map((c) => String(c.itemId))
  );

  const faltantes = [];
  for (const material of reserva.materialesReservados ?? []) {
    // Corte temprano para no ir a buscar el Item de un material que no puede exigir.
    if (material.consumoEjecutado !== true || material.liquidado === true) continue;
    const item = await Item.findById(material.itemId)
      .select("esConsumible nombre")
      .session(session ?? null);
    if (!requiereConsumoReportado(material, item)) continue;
    if (!reportados.has(String(material.itemId))) {
      faltantes.push(item.nombre || String(material.itemId));
    }
  }

  if (faltantes.length > 0) {
    throw Object.assign(
      new Error(
        `Debe indicar la cantidad consumida de los siguientes consumibles para finalizar: ${faltantes.join(", ")}.`
      ),
      { status: 400 }
    );
  }
};

/*
 * Regla de negocio: el descarte solo aplica a ítems reutilizables
 * (esConsumible === false). Un consumible no se descarta —o se consume (se reporta
 * vía `consumos`) o se devuelve sin consumir—, así que rechazamos de entrada
 * cualquier descarte que apunte a un consumible.
 *
 * Se ejecuta ANTES del loop que registra descartes en finalizarPedidoService
 * (fail-fast): registrarDescarteService commitea su propia transacción por
 * descarte, por lo que validar acá evita dejar descartes parciales persistidos.
 *
 * `descartes`: [{ tipo, itemId, ... }] — los de tipo "equipo" (desperfectos) se
 * ignoran, no son descartes de stock. Lanza Error con `status: 400` listando los
 * consumibles encontrados.
 */
export const validarDescartesReutilizables = async (descartes = [], { session = null } = {}) => {
  const itemIds = [
    ...new Set(
      descartes
        .filter((d) => d?.tipo !== "equipo" && d?.itemId)
        .map((d) => String(d.itemId))
    ),
  ];
  if (itemIds.length === 0) return;

  const items = await Item.find({ _id: { $in: itemIds } })
    .select("esConsumible nombre")
    .session(session ?? null);

  const consumibles = items
    .filter((item) => item.esConsumible !== false)
    .map((item) => item.nombre || String(item._id));

  if (consumibles.length > 0) {
    throw Object.assign(
      new Error(
        `Solo se pueden descartar ítems reutilizables. Los siguientes son consumibles y deben reportarse como consumo: ${consumibles.join(", ")}.`
      ),
      { status: 400 }
    );
  }
};

export const aplicarDevolucionesFinalizacion = async (
  reserva,
  { consumos = [], usuarioId = null, session = null } = {}
) => {
  const consumoPorItem = new Map(
    consumos.map((c) => [String(c.itemId), c.cantidadConsumida])
  );

  for (const material of reserva.materialesReservados) {
    // Ya saldado (por el cron al vencer la ventana, o por una finalización previa):
    // sus lotes no se tocan. Esta guarda es lo que vuelve idempotente la función y
    // lo que evita la doble devolución de reutilizables cuando el pedido se
    // finaliza después de que el cron ya cerró la reserva.
    if (material.liquidado === true) continue;

    // Sin descuento físico previo (§7), `lotesUsados` es solo un puntero FIFO que
    // NUNCA salió del inventario: devolverlo inyectaría stock fantasma. No hay nada
    // que reponer y el consumo real es 0.
    if (material.consumoEjecutado !== true) {
      material.cantidadConsumidaReal = 0;
      material.liquidado = true;
      continue;
    }

    const item = await Item.findById(material.itemId)
      .select("esConsumible")
      .session(session ?? null);
    const decrementado = (material.lotesUsados ?? []).reduce((acc, l) => acc + l.cantidad, 0);
    if (decrementado <= 0) {
      material.liquidado = true;
      continue;
    }

    const esReutilizable = item && item.esConsumible === false;
    let aDevolver;
    if (esReutilizable) {
      aDevolver = decrementado; // el reutilizable vuelve completo
    } else {
      const reportado = consumoPorItem.get(String(material.itemId));
      // El `?? decrementado` es un fallback defensivo hoy inalcanzable: el gate
      // (validarConsumosRequeridos) garantiza que todo consumible sin liquidar
      // llegue con su consumo reportado. Se conserva porque, si un caller futuro
      // esquivara el gate, asumir "se consumió todo" NO devuelve nada y por lo
      // tanto no infla el inventario; un `?? 0` haría que una omisión accidental
      // repusiera stock realmente consumido. La exigencia vive en el gate, no acá.
      const consumido = Math.min(reportado ?? decrementado, decrementado);
      material.cantidadConsumidaReal = consumido;
      aDevolver = decrementado - consumido;
    }
    if (aDevolver <= 0) {
      material.liquidado = true;
      continue;
    }

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
    material.liquidado = true;
  }
};
