import mongoose from "mongoose";
import Reserva from "../models/reserva.model.js";
import Pedido from "../models/pedido.model.js";
import { soportaTransacciones } from "../services/aprobacionReserva.js";
import { devolverYRegistrar, aplicarDevolucionesFinalizacion } from "../services/devolucionReserva.js";

// Controlador para listar reservas activas filtradas por un laboratorio específico
const getReservasActivasPorLaboratorio = async (req, res) => {
  try {
    const { laboratorioId } = req.params;
    
    const reservas = await Reserva.find({
      laboratorioId,
      estado: { $in: ['Pendiente', 'En Curso'] }
    })
      .populate("docenteId", "nombre apellido email")
      .populate("pedidoId", "materia alumnos")
      .populate("equiposReservados.equipoId", "nombre tipo codigo")
      .sort({ fechaHora: 1 }); // Ordenadas cronológicamente

    res.json(reservas);
  } catch (error) {
    console.error("Error en getReservasActivasPorLaboratorio:", error);
    res.status(500).json({ error: error.message });
  }
};

// Controlador para listar TODAS las reservas activas (Ideal para el calendario general del frontend)
const getReservasActivas = async (req, res) => {
  try {
    // Soportamos filtrado por rango de fechas (startDate, endDate) para el calendario semanal
    const { startDate, endDate } = req.query;
    
    let filtro = { estado: { $in: ['Pendiente', 'En Curso'] } };

    if (startDate && endDate) {
      const parsedStart = new Date(startDate);
      const parsedEnd = new Date(endDate);

      if (!isNaN(parsedStart) && !isNaN(parsedEnd)) {
        filtro.fechaHora = {
          $gte: parsedStart,
          $lte: parsedEnd
        };
      }
    }

    const reservas = await Reserva.find(filtro)
      .populate("laboratorioId", "nombre tipo capacidad")
      .populate("docenteId", "nombre apellido email")
      .populate("pedidoId", "materia alumnos") // Traemos info clave del pedido original
      .sort({ fechaHora: 1 });

    res.json(reservas);
  } catch (error) {
    console.error("Error en getReservasActivas:", error);
    res.status(500).json({ error: error.message });
  }
};

const cancelarReserva = async (req, res) => {
  try {
    const { id } = req.params;
    const reserva = await Reserva.findById(id);

    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    if (reserva.estado === 'Cancelada' || reserva.estado === 'Finalizada') {
      return res.status(400).json({ error: `No se puede cancelar una reserva que ya está en estado ${reserva.estado}` });
    }

    // 1. Restaurar stock SOLO de lo que fue físicamente descontado.
    //    cantidadDisponible se decrementa cuando la reserva pasa a "En Curso"
    //    (cronReservas.ejecutarConsumoFisico), para consumibles Y reutilizables.
    //    En cualquier otro estado —Pendiente/Conflicto— no se decrementó nada, así
    //    que no se repone (reponer inflaría el inventario). Se devuelve el 100% de
    //    lo que salió (todo lotesUsados). Best-effort: este controlador no es
    //    transaccional, un fallo del historial no debe romper la cancelación.
    const restauraStock = reserva.estado === 'En Curso';
    if (restauraStock) {
      for (const material of reserva.materialesReservados) {
        const total = (material.lotesUsados ?? []).reduce((acc, l) => acc + l.cantidad, 0);
        if (total <= 0) continue;
        try {
          await devolverYRegistrar(reserva, material, total, {
            usuarioId: req.usuario?.id,
            observacion: 'Reposición de stock por cancelación de reserva'
          });
        } catch (error) {
          console.error("[cancelarReserva] no se pudo reponer/registrar el stock:", error.message);
        }
      }
    }

    // 3. Sincronizar estados (Actualizamos la reserva y rechazamos el pedido original)
    reserva.estado = 'Cancelada';
    await reserva.save();

    await Pedido.findByIdAndUpdate(reserva.pedidoId, { estado: 'Rechazado' });

    // El stock solo se repone si la reserva estaba 'En Curso' (única situación en
    // que hubo consumo físico); no lo afirmamos cuando no se restauró nada.
    const message = restauraStock
      ? "Reserva cancelada exitosamente. Se liberaron los equipos y se restauró el stock consumido."
      : "Reserva cancelada exitosamente. Se liberaron los equipos.";

    res.json({ message, reserva });
  } catch (error) {
    console.error("Error en cancelarReserva:", error);
    res.status(500).json({ error: error.message });
  }
};

/*
 * Finalización MANUAL de una reserva En Curso reportando el consumo real de cada
 * consumible (§10). Devuelve el sobrante (reservado − consumido) al stock y, para
 * reutilizables, devuelve el 100%. El cron sigue finalizando por tiempo las que
 * nadie cierra a mano, asumiendo consumo total de consumibles.
 *
 * Body: { consumos?: [{ itemId, cantidadConsumida }] }. Los itemId omitidos se dan
 * por consumidos en su totalidad. Un consumo mayor a lo reservado se clampa a lo
 * reservado (no se puede consumir más de lo que salió).
 */
const finalizarReserva = async (req, res) => {
  try {
    const { id } = req.params;
    const { consumos = [] } = req.body ?? {};

    // Claim atómico En Curso → Finalizada + devoluciones, en transacción si se
    // soporta (así no compite con el cron ni deja stock a medio devolver).
    const runFinalizar = async (session) => {
      const claimOpts = { new: true, ...(session ? { session } : {}) };
      const reserva = await Reserva.findOneAndUpdate(
        { _id: id, estado: "En Curso" },
        { $set: { estado: "Finalizada" } },
        claimOpts
      );
      if (!reserva) return null; // no existe, o no está En Curso (ya la tomó el cron)

      await aplicarDevolucionesFinalizacion(reserva, {
        consumos,
        usuarioId: req.usuario?.id,
        session,
      });

      await reserva.save(session ? { session } : undefined);
      return reserva;
    };

    let reserva;
    if (await soportaTransacciones()) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          reserva = await runFinalizar(session);
        });
      } finally {
        await session.endSession();
      }
    } else {
      reserva = await runFinalizar(null);
    }

    if (!reserva) {
      const existe = await Reserva.exists({ _id: id });
      return res.status(existe ? 400 : 404).json({
        error: existe
          ? "Solo se puede finalizar manualmente una reserva En Curso"
          : "Reserva no encontrada",
      });
    }

    return res.json({ message: "Reserva finalizada exitosamente", reserva });
  } catch (error) {
    console.error("Error en finalizarReserva:", error);
    return res.status(500).json({ error: error.message });
  }
};

export {
  getReservasActivasPorLaboratorio,
  getReservasActivas,
  cancelarReserva,
  finalizarReserva
};