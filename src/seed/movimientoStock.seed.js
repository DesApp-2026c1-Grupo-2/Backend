import MovimientoStock from "../models/movimientoStock.model.js";
import Item from "../models/item.model.js";
import Lote from "../models/lote.model.js";
import Reserva from "../models/reserva.model.js";
import Descarte from "../models/descarte.model.js";
import { stockFisicoItem } from "../services/movimientoStock.service.js";

/*
 * Seed del HISTORIAL de movimientos de stock (ver
 * docs/Diseno_Historial_Movimientos_Stock.md).
 *
 * Debe correr AL FINAL (después de inventario/reservas/descartes) porque
 * reconstruye la auditoría a partir del estado físico ya sembrado, respetando el
 * invariante del modelo: cantidadNueva = cantidadAnterior + cantidad, donde
 * cantidadAnterior/cantidadNueva son el STOCK FÍSICO AGREGADO del item.
 *
 * Reconstrucción, por item y en orden cronológico:
 *   1. COMPRA           → alta inicial que dejó el stock en su valor de partida.
 *   2. APROBACION_RESERVA → egreso físico al iniciar cada reserva ejecutada.
 *                           Consumibles: En Curso y Finalizada (no vuelven).
 *                           Reutilizables: solo En Curso (los de Finalizada ya
 *                           devolvieron, efecto neto cero — no se reconstruyen).
 *   3. DESCARTE         → cada pérdida registrada por descarte.seed.
 *
 * El stock inicial se deduce hacia atrás: inicial = final + Σ egresos, de modo
 * que la cadena de saldos termina exactamente en el stock físico actual.
 *
 * Se backdatea `createdAt` (vía inserción con el driver nativo) para que el
 * historial ordenado por fecha refleje la secuencia real de eventos.
 */

const DIA = 24 * 60 * 60 * 1000;

export const seedMovimientosStock = async () => {
  try {
    await MovimientoStock.deleteMany({});

    const items = await Item.find({});
    const reservasEjecutadas = await Reserva.find({
      estado: { $in: ["En Curso", "Finalizada"] },
    });
    // Solo descartes de inventario (material/reactivo); los de equipo no tocan stock.
    const descartesInventario = await Descarte.find({
      tipo: { $in: ["material", "reactivo"] },
      itemId: { $exists: true, $ne: null },
    });

    const movimientos = [];

    for (const item of items) {
      // Egresos que efectivamente cambiaron el stock físico de este item.
      const egresos = [];

      // Egreso al iniciar la reserva. Consumible: cualquier reserva ejecutada (En
      // Curso o Finalizada; el consumible no vuelve). Reutilizable: SOLO En Curso —
      // las Finalizada ya devolvieron su stock (efecto neto cero), así que su
      // decremento no está reflejado en el físico actual y no debe reconstruirse.
      const reservasConEgreso = item.esConsumible
        ? reservasEjecutadas
        : reservasEjecutadas.filter((r) => r.estado === "En Curso");
      for (const reserva of reservasConEgreso) {
        for (const mat of reserva.materialesReservados) {
          if (String(mat.itemId) === String(item._id) && mat.cantidadTotal > 0) {
            egresos.push({
              tipo: "APROBACION_RESERVA",
              cantidad: -mat.cantidadTotal,
              fecha: reserva.fechaInicioReal,
              reservaId: reserva._id,
              usuarioId: reserva.docenteId,
              observacion: item.esConsumible
                ? "Consumo físico al iniciar la reserva"
                : "Salida de material reutilizable al iniciar la reserva",
            });
          }
        }
      }

      // Descartes registrados sobre este item.
      for (const descarte of descartesInventario) {
        if (String(descarte.itemId) === String(item._id) && descarte.cantidad > 0) {
          egresos.push({
            tipo: "DESCARTE",
            cantidad: -descarte.cantidad,
            fecha: descarte.createdAt || new Date(),
            reservaId: descarte.reservaId,
            usuarioId: descarte.usuarioId,
            observacion: descarte.motivo,
          });
        }
      }

      const stockFinal = await stockFisicoItem(item._id);
      const totalEgresos = egresos.reduce((acc, e) => acc + Math.abs(e.cantidad), 0);
      const stockInicial = stockFinal + totalEgresos;

      // Item sin stock ni historia: nada que auditar.
      if (stockInicial <= 0 && egresos.length === 0) continue;

      // COMPRA inicial fechada en la creación del lote más antiguo del item.
      const loteMasViejo = await Lote.findOne({ itemId: item._id }).sort({ fechaCreacion: 1 });
      const fechaLoteMasViejo = loteMasViejo?.fechaCreacion || new Date();

      // La COMPRA debe preceder SIEMPRE a cualquier egreso, o el sort dejaría un
      // saldo corriente transitoriamente negativo (historia irreal). Si algún
      // egreso fuese anterior al lote más viejo, anclamos la COMPRA un día antes
      // del primer evento.
      const fechaPrimerEgreso = egresos.reduce(
        (min, e) => (new Date(e.fecha) < min ? new Date(e.fecha) : min),
        fechaLoteMasViejo
      );
      const fechaCompra =
        fechaPrimerEgreso < fechaLoteMasViejo
          ? new Date(fechaPrimerEgreso.getTime() - DIA)
          : fechaLoteMasViejo;

      const eventos = [
        {
          tipo: "COMPRA",
          cantidad: stockInicial,
          fecha: fechaCompra,
          observacion: "Alta inicial de stock (siembra)",
        },
        ...egresos,
      ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      // Recorre los eventos acumulando el saldo físico del item.
      let saldo = 0;
      for (const ev of eventos) {
        const cantidadAnterior = saldo;
        saldo += ev.cantidad;
        movimientos.push({
          itemId: item._id,
          tipoMovimiento: ev.tipo,
          cantidad: ev.cantidad,
          cantidadAnterior,
          cantidadNueva: saldo,
          reservaId: ev.reservaId,
          usuarioId: ev.usuarioId,
          observacion: ev.observacion,
          createdAt: new Date(ev.fecha),
          updatedAt: new Date(ev.fecha),
          __v: 0,
        });
      }
    }

    if (movimientos.length > 0) {
      // Inserción con el driver nativo para respetar los `createdAt` backdateados
      // (Mongoose sobrescribiría los timestamps en insertMany).
      await MovimientoStock.collection.insertMany(movimientos);
      console.log(`✅ Se registraron ${movimientos.length} movimientos de stock de prueba.`);
    } else {
      console.log("ℹ️ No se generaron movimientos de stock (sin inventario ni operaciones).");
    }
  } catch (error) {
    console.error("❌ Error al sembrar los movimientos de stock:", error);
  }
};

export const rollbackMovimientosStock = async () => {
  try {
    await MovimientoStock.deleteMany({});
    console.log("⏪ Rollback: Movimientos de stock eliminados correctamente.");
  } catch (error) {
    console.error("❌ Error al revertir los movimientos de stock:", error);
  }
};
