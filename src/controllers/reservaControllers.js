import Reserva from "../models/reserva.model.js";
import Equipo from "../models/equipo.model.js";
import Lote from "../models/lote.model.js";
import Pedido from "../models/pedido.model.js";
import Item from "../models/item.model.js";

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
    //    Con el modelo de disponibilidad temporal, cantidadDisponible se
    //    decrementa únicamente cuando la reserva pasó a "En Curso" y el material
    //    es consumible (cronReservas.ejecutarConsumoFisico). En cualquier otro
    //    caso —reserva Pendiente, o materiales reutilizables— los lotesUsados son
    //    solo punteros FIFO y nunca se restó nada: reponer inflaría el inventario.
    if (reserva.estado === 'En Curso') {
      for (const material of reserva.materialesReservados) {
        const item = await Item.findById(material.itemId).select('esConsumible');
        if (!item || item.esConsumible !== true) continue; // reutilizable: nada que reponer
        for (const lote of material.lotesUsados) {
          await Lote.findByIdAndUpdate(lote.loteId, {
            $inc: { cantidadDisponible: lote.cantidad }
          });
        }
      }
    }

    // 3. Sincronizar estados (Actualizamos la reserva y rechazamos el pedido original)
    reserva.estado = 'Cancelada';
    await reserva.save();
    
    await Pedido.findByIdAndUpdate(reserva.pedidoId, { estado: 'Rechazado' });

    res.json({ message: "Reserva cancelada exitosamente. Se liberaron los equipos y se restauró el stock.", reserva });
  } catch (error) {
    console.error("Error en cancelarReserva:", error);
    res.status(500).json({ error: error.message });
  }
};

export {
  getReservasActivasPorLaboratorio,
  getReservasActivas,
  cancelarReserva
};