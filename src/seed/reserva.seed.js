import mongoose from "mongoose";
import Reserva from "../models/reserva.model.js";
import Pedido from "../models/pedido.model.js";
import Item from "../models/item.model.js";
import Lote from "../models/lote.model.js";

/*
 * Seed de reservas coherente con el modelo de stock temporal
 * (docs/stock-disponibilidad-temporal.md).
 *
 * - El estado de la reserva se DERIVA de su ventana vs. ahora (Finalizada /
 *   En Curso / Pendiente), igual que lo haría el cron. Así el estado sembrado
 *   no entra en conflicto con la próxima corrida del cron.
 * - Consumo físico (§7): al pasar a "En Curso" se decrementa cantidadDisponible
 *   (FIFO) tanto de consumibles como de reutilizables. Diferencia al finalizar
 *   (§10): el reutilizable DEVUELVE su stock, así que una reserva Finalizada tiene
 *   efecto neto cero para reutilizables (no decrementa en el seed); el consumible
 *   no vuelve (queda decrementado en En Curso y Finalizada). Las reservas Pendiente
 *   no decrementan nada (solo dejan punteros FIFO para trazabilidad de descartes).
 * - `liquidado` (§10) refleja si queda stock afuera por saldar, imitando lo que
 *   deja el cron: al cerrar una ventana devuelve los reutilizables (los salda) y
 *   deja los consumibles PENDIENTES, porque su sobrante solo se puede calcular
 *   con el consumo real reportado al finalizar el pedido.
 */

const HORA = 60 * 60 * 1000;

// Asigna lotes FIFO como punteros. Si `consumir` es true, además decrementa el
// stock físico del lote (imita el §7). Devuelve [{ loteId, cantidad }].
const asignarLotes = async (itemId, cantidadTotal, consumir) => {
  const lotes = await Lote.find({
    itemId,
    estado: "disponible",
    cantidadDisponible: { $gt: 0 },
  }).sort({ fechaVencimiento: 1, fechaCreacion: 1 });

  const lotesUsados = [];
  let restante = cantidadTotal;
  for (const lote of lotes) {
    if (restante <= 0) break;
    const usar = Math.min(lote.cantidadDisponible, restante);
    lotesUsados.push({ loteId: lote._id, cantidad: usar });
    restante -= usar;
    if (consumir) {
      lote.cantidadDisponible -= usar;
      await lote.save();
    }
  }
  return lotesUsados;
};

export const seedReservas = async () => {
  try {
    await Reserva.deleteMany({});

    // Solo los pedidos Aceptado/Finalizado tienen una reserva real.
    const pedidos = await Pedido.find({ estado: { $in: ["Aceptado", "Finalizado"] } });

    if (!pedidos.length) {
      console.log("⚠️ No hay pedidos Aceptados/Finalizados para generar Reservas. Ejecuta primero pedido.seed.js.");
      return;
    }

    const ahora = Date.now();
    const reservasPrueba = [];

    for (const pedido of pedidos) {
      const duracionClase = pedido.duracionClase || 120;
      const inicioMs = new Date(pedido.fechaHora).getTime();
      const fechaInicioReal = new Date(inicioMs - HORA); // 1h antes
      const fechaFinReal = new Date(inicioMs + (duracionClase + 30) * 60 * 1000);

      // Estado derivado de la ventana (coherente con lo que haría el cron).
      let estadoReserva;
      if (fechaFinReal.getTime() <= ahora) estadoReserva = "Finalizada";
      else if (fechaInicioReal.getTime() <= ahora) estadoReserva = "En Curso";
      else estadoReserva = "Pendiente";

      const yaEjecutada = estadoReserva === "En Curso" || estadoReserva === "Finalizada";
      // Un pedido ya Finalizado pasó por la finalización: sus materiales quedaron saldados.
      const pedidoYaFinalizado = pedido.estado === "Finalizado";

      const equiposReservados = [];
      const materialesReservados = [];

      for (const r of pedido.recursos) {
        const ref = r.modeloRef || r.tipoRecurso;
        if (ref === "Equipo") {
          equiposReservados.push({ equipoId: r.recursoId });
        } else if (ref === "Item") {
          const item = await Item.findById(r.recursoId);
          const esConsumible = item?.esConsumible === true;
          // Consumible: decrementa si ya se ejecutó (En Curso o Finalizada; no vuelve).
          // Reutilizable: decrementa SOLO En Curso (si Finalizada, ya devolvió → neto 0).
          const consumir = esConsumible ? yaEjecutada : estadoReserva === "En Curso";
          const lotesUsados = await asignarLotes(r.recursoId, r.cantidad, consumir);

          // ¿Queda algo afuera por saldar? Nunca se marca un material de una reserva
          // Pendiente: el cron la va a promover más tarde y en ese momento el consumo
          // SÍ debe exigirse; marcarlo acá silenciaría ese pedido para siempre.
          //  - pedido ya Finalizado → su finalización saldó todo;
          //  - reutilizable de reserva Finalizada → el cron ya lo devolvió (neto 0);
          //  - consumible de reserva Finalizada con el pedido aún Aceptado → queda
          //    PENDIENTE a propósito: es la ventana en la que todavía se puede
          //    reportar el consumo real y recuperar el sobrante.
          let liquidado = false;
          if (pedidoYaFinalizado) liquidado = yaEjecutada;
          else if (estadoReserva === "Finalizada" && !esConsumible) liquidado = true;

          const material = {
            itemId: r.recursoId,
            cantidadTotal: r.cantidad,
            // `consumir` refleja si el descuento físico ya se aplicó (§7). Sin él,
            // lotesUsados es solo un puntero FIFO que no debe devolverse al finalizar.
            consumoEjecutado: consumir,
            liquidado,
            lotesUsados,
          };
          // El pedido Finalizado ya reportó su consumo: sus consumibles se dieron
          // por consumidos en su totalidad (no volvió sobrante), que es lo coherente
          // con que su stock haya quedado decrementado.
          if (pedidoYaFinalizado && esConsumible) material.cantidadConsumidaReal = r.cantidad;

          materialesReservados.push(material);
        }
      }

      reservasPrueba.push({
        pedidoId: pedido._id,
        laboratorioId: pedido.laboratorio,
        docenteId: pedido.docente,
        fechaHora: pedido.fechaHora,
        duracionClase,
        fechaInicioReal,
        fechaFinReal,
        estado: estadoReserva,
        equiposReservados,
        materialesReservados,
      });
    }

    await Reserva.insertMany(reservasPrueba);
    console.log(`✅ Se insertaron exitosamente ${reservasPrueba.length} reservas de prueba.`);
  } catch (error) {
    console.error("❌ Error al sembrar las reservas:", error);
  }
};

export const rollbackReservas = async () => {
  try {
    await Reserva.deleteMany({});
    console.log("⏪ Rollback: Reservas eliminadas correctamente.");
  } catch (error) {
    console.error("❌ Error al revertir las reservas:", error);
  }
};
