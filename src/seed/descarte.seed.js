import Descarte from "../models/descarte.model.js";
import Reserva from "../models/reserva.model.js";
import Lote from "../models/lote.model.js";
import Equipo from "../models/equipo.model.js";
import Item from "../models/item.model.js";

/*
 * Seed de descartes DETERMINISTA. Registra pérdidas físicas sobre reservas ya
 * ejecutadas (En Curso / Finalizada), sin aleatoriedad:
 *   - un descarte de material (rotura) sobre la primera reserva ejecutada,
 *   - un daño de equipo (fuera de servicio) sobre esa misma reserva si tiene equipo.
 * El impacto físico sobre el lote se aplica de forma acotada (nunca deja stock
 * negativo).
 */

export const seedDescartes = async () => {
  try {
    await Descarte.deleteMany({});

    // Solo se descarta lo que efectivamente se usó (reservas ejecutadas).
    const reservas = await Reserva.find({ estado: { $in: ["En Curso", "Finalizada"] } })
      .sort({ fechaFinReal: 1 });

    if (!reservas.length) {
      console.log("⚠️ No se generaron descartes: no hay reservas En Curso/Finalizadas.");
      return;
    }

    const reserva = reservas[0];
    const descartesPrueba = [];

    // 1. Descarte de material: rompemos una fracción fija del primer material.
    const mat = reserva.materialesReservados[0];
    if (mat && mat.cantidadTotal > 0 && mat.lotesUsados.length > 0) {
      // Descartamos ~20% de lo reservado (al menos 1 unidad).
      const aDescartar = Math.max(1, Math.floor(mat.cantidadTotal * 0.2));
      let restante = aDescartar;
      const lotesAfectados = [];

      for (const lu of mat.lotesUsados) {
        if (restante <= 0) break;
        const cant = Math.min(lu.cantidad, restante);
        lotesAfectados.push({ loteId: lu.loteId, cantidad: cant });
        restante -= cant;

        // Impacto físico acotado: descontar del lote si aún tiene stock.
        const lote = await Lote.findById(lu.loteId);
        if (lote && lote.cantidadDisponible >= cant) {
          lote.cantidadDisponible -= cant;
          if (lote.cantidadDisponible === 0) lote.estado = "descartado";
          await lote.save();
        }
      }

      const itemBase = await Item.findById(mat.itemId);
      descartesPrueba.push({
        pedidoId: reserva.pedidoId,
        reservaId: reserva._id,
        tipo: itemBase?.tipo === "reactivo" ? "reactivo" : "material",
        itemId: mat.itemId,
        cantidad: aDescartar,
        motivo: "Rotura accidental de material durante la práctica de laboratorio",
        usuarioId: reserva.docenteId,
        lotesAfectados,
      });
    }

    // 2. Daño de equipo: marcamos el primer equipo de la reserva fuera de servicio.
    if (reserva.equiposReservados.length > 0) {
      const eq = await Equipo.findById(reserva.equiposReservados[0].equipoId);
      if (eq && eq.estado !== "fuera de servicio") {
        eq.estado = "fuera de servicio";
        await eq.save();

        descartesPrueba.push({
          pedidoId: reserva.pedidoId,
          reservaId: reserva._id,
          tipo: "equipo",
          equipoId: eq._id,
          cantidad: 1,
          motivo: "El equipo presentó fallas de calibración severas tras el uso",
          usuarioId: reserva.docenteId,
        });
      }
    }

    if (descartesPrueba.length > 0) {
      await Descarte.insertMany(descartesPrueba);
      console.log(`✅ Se registraron exitosamente ${descartesPrueba.length} descartes en el inventario.`);
    } else {
      console.log("ℹ️ No se generaron descartes (sin materiales/equipos aptos).");
    }
  } catch (error) {
    console.error("❌ Error al generar los descartes:", error);
  }
};
