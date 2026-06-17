import Descarte from "../models/descarte.model.js";
import Reserva from "../models/reserva.model.js";
import Lote from "../models/lote.model.js";
import Equipo from "../models/equipo.model.js";
import Item from "../models/item.model.js";

export const seedDescartes = async () => {
  try {
    await Descarte.deleteMany({});

    // Solo generamos descartes para pedidos que han sido utilizados físicamente
    const reservas = await Reserva.find({ estado: { $in: ["En Curso", "Finalizada"] } });
    
    if (!reservas || reservas.length === 0) {
      console.log("⚠️ No se generaron descartes porque no hay reservas Activas o Finalizadas.");
      return;
    }

    // Tomaremos solo algunas reservas al azar para los descartes
    const reservasAfectadas = reservas.slice(0, 3);
    const descartesPrueba = [];

    for (const reserva of reservasAfectadas) {
      // --- 1. Descarte de Materiales / Reactivos ---
      for (const mat of reserva.materialesReservados) {
        // Simulamos una probabilidad del 60% de que algún item de esta reserva sufra rotura
        if (Math.random() > 0.4 && mat.cantidadTotal > 0) {
          // Descartamos una cantidad aleatoria pero NUNCA mayor a lo reservado
          const aDescartar = Math.floor(Math.random() * mat.cantidadTotal) + 1;
          let restante = aDescartar;
          const lotesAfectados = [];

          for (const loteUsado of mat.lotesUsados) {
            if (restante <= 0) break;
            
            const descuentolocal = Math.min(loteUsado.cantidad, restante);
            lotesAfectados.push({ loteId: loteUsado.loteId, cantidad: descuentolocal });
            restante -= descuentolocal;

            // IMPACTO REAL: Disminuimos la cantidad del lote si es que aún tiene para no inflar inconsistencias
            // (Aunque si el seeder de reservas ya lo restó en la DB, al descartarlo simplemente afirmamos la pérdida,
            // restando más si por alguna razón devolvió al finalizar el pedido).
            const loteFisico = await Lote.findById(loteUsado.loteId);
            if (loteFisico && loteFisico.cantidadDisponible >= descuentolocal) {
              loteFisico.cantidadDisponible -= descuentolocal;
              if (loteFisico.cantidadDisponible === 0) loteFisico.estado = 'descartado';
              await loteFisico.save();
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
            lotesAfectados
          });
        }
      }

      // --- 2. Descarte / Daño de Equipos ---
      if (reserva.equiposReservados.length > 0 && Math.random() > 0.7) {
        const eqReservado = reserva.equiposReservados[0];
        
        const equipoFisico = await Equipo.findById(eqReservado.equipoId);
        if (equipoFisico && equipoFisico.estado !== 'fuera de servicio') {
          equipoFisico.estado = 'fuera de servicio';
          await equipoFisico.save();

          descartesPrueba.push({
            pedidoId: reserva.pedidoId,
            reservaId: reserva._id,
            tipo: "equipo",
            equipoId: equipoFisico._id,
            cantidad: 1,
            motivo: "El equipo presentó fallas de calibración severas tras el uso",
            usuarioId: reserva.docenteId,
          });
        }
      }
    }

    if (descartesPrueba.length > 0) {
      await Descarte.insertMany(descartesPrueba);
      console.log(`✅ Se registraron exitosamente ${descartesPrueba.length} descartes en el inventario.`);
    }
  } catch (error) {
    console.error("❌ Error al generar los descartes:", error);
  }
};