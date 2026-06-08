import mongoose from "mongoose";
import Reserva from "../models/reserva.model.js";
import Pedido from "../models/pedido.model.js";
import Lote from "../models/lote.model.js";

/**
 * UP: Inserta reservas de prueba basándose en los Pedidos existentes en la base de datos.
 */
export const seedReservas = async () => {
  try {
    // Limpiamos las reservas previas para evitar duplicados en el seed
    await Reserva.deleteMany({});

    // Buscamos pedidos válidos para generarles una reserva asociada
    // Solo los pedidos "Aceptado" o "Finalizado" deberían tener una reserva real
    const pedidos = await Pedido.find({ estado: { $in: ["Aceptado", "Finalizado", "En Curso"] } });

    if (!pedidos || pedidos.length === 0) {
      console.log("⚠️ No se encontraron Pedidos válidos (Aceptados/Finalizados) para generar Reservas. Ejecuta primero pedido.seed.js.");
      return;
    }

    const reservasPrueba = [];

    for (const pedido of pedidos) {
      // Mapear los recursos del pedido al formato exigido por Reserva
      const equiposReservados = [];
      const materialesReservados = [];

      for (const r of pedido.recursos) {
        const ref = r.modeloRef || r.tipoRecurso;
        
        if (ref === "Equipo") {
          equiposReservados.push({ equipoId: r.recursoId });
        } else if (ref === "Item") {
          // Simulamos el lote usado. Si el pedido guardó los lotes descontados los usamos.
          let lotesUsados = [];
          if (r.lotesDescontados && r.lotesDescontados.length > 0) {
            lotesUsados = r.lotesDescontados.map(l => ({
              loteId: l.loteId,
              cantidad: l.cantidadDescontada
            }));
          } else {
            // Intentamos buscar al menos un lote de este ítem para rellenar la relación
            const lote = await Lote.findOne({ itemId: r.recursoId });
            if (lote) {
              lotesUsados.push({ loteId: lote._id, cantidad: r.cantidad });
            }
          }

          materialesReservados.push({
            itemId: r.recursoId,
            cantidadTotal: r.cantidad,
            lotesUsados: lotesUsados
          });
        }
      }

      // Calculamos el estado de la reserva coherente al estado del pedido
      const estadoReserva = pedido.estado === "Finalizado" ? "Finalizada" : "Pendiente";

      reservasPrueba.push({
        pedidoId: pedido._id,
        laboratorioId: pedido.laboratorio,
        docenteId: pedido.docente,
        fechaHora: pedido.fechaHora,
        estado: estadoReserva,
        equiposReservados,
        materialesReservados
      });
    }

    if (reservasPrueba.length > 0) {
      await Reserva.insertMany(reservasPrueba);
      console.log(`✅ Se insertaron exitosamente ${reservasPrueba.length} reservas de prueba.`);
    }
  } catch (error) {
    console.error("❌ Error al sembrar las reservas:", error);
  }
};

/**
 * DOWN: Elimina todas las reservas (Rollback).
 */
export const rollbackReservas = async () => {
  try {
    await Reserva.deleteMany({});
    console.log("⏪ Rollback: Reservas eliminadas correctamente.");
  } catch (error) {
    console.error("❌ Error al revertir las reservas:", error);
  }
};