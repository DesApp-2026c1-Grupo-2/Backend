const Reserva = require("../models/reserva.model");
const Equipo = require("../models/equipo.model");
const Lote = require("../models/lote.model");
const Pedido = require("../models/pedido.model");

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
      filtro.fechaHora = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const reservas = await Reserva.find(filtro)
      .populate("laboratorioId", "nombre tipo capacidad")
      .populate("docenteId", "nombre apellido email")
      .populate("pedidoId", "materia alumnos") // Traemos info clave del pedido original
      .sort({ fechaHora: 1 });

    res.json(reservas);
  } catch (error) {
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

    // 1. Restaurar stock a los lotes (Devolvemos TODO porque la reserva no ocurrió)
    for (const material of reserva.materialesReservados) {
      for (const lote of material.lotesUsados) {
        await Lote.findByIdAndUpdate(lote.loteId, {
          $inc: { cantidadDisponible: lote.cantidad }
        });
      }
    }

    // 3. Sincronizar estados (Actualizamos la reserva y rechazamos el pedido original)
    reserva.estado = 'Cancelada';
    await reserva.save();
    
    await Pedido.findByIdAndUpdate(reserva.pedidoId, { estado: 'Rechazado' });

    res.json({ message: "Reserva cancelada exitosamente. Se liberaron los equipos y se restauró el stock.", reserva });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getReservasActivasPorLaboratorio,
  getReservasActivas,
  cancelarReserva
};