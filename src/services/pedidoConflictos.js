import Pedido from "../models/pedido.model.js";
import Equipo from "../models/equipo.model.js";
import Lote from "../models/lote.model.js";
import Laboratorio from "../models/laboratorio.model.js";
import Reserva from "../models/reserva.model.js";

const verificarConflictos = async (pedido) => {
  const conflictos = [];

  let inicioReal = null;
  let finReal = null;
  if (pedido.fechaHora && !isNaN(new Date(pedido.fechaHora).getTime())) {
    const duracionClase = pedido.duracionClase || 120; // Fallback (120 min) para pedidos antiguos
    inicioReal = new Date(pedido.fechaHora.getTime() - 60 * 60 * 1000);
    finReal = new Date(pedido.fechaHora.getTime() + (duracionClase + 30) * 60 * 1000);
  }

  // =========================
  // LABORATORIO
  // =========================

  if (!pedido.laboratorio) {
    conflictos.push({
      tipo: "laboratorio_no_asignado",
      severidad: "media",
      mensaje: "El pedido no tiene un laboratorio asignado. Debe asignarse uno antes de aprobar.",
    });
  } else {

  const laboratorio = await Laboratorio.findById(
    pedido.laboratorio
  );

  if (!laboratorio) {
    conflictos.push({
      tipo: "laboratorio_no_existente",
      severidad: "alta",
      mensaje: "El laboratorio solicitado no existe",
    });
  } else {
    if (pedido.alumnos > laboratorio.capacidad) {
      conflictos.push({
        tipo: "pedido_sobredimensionado",
        severidad: "alta",
        mensaje:
          `Capacidad del laboratorio: ${laboratorio.capacidad}. ` +
          `Alumnos solicitados: ${pedido.alumnos}.`,
      });
    }

    // Retiramos el estado "reservado" obsoleto, evaluando inoperatividad real
    if (
      laboratorio.estado === "en mantenimiento" ||
      laboratorio.estado === "fuera de servicio"
    ) {
      conflictos.push({
        tipo: "laboratorio_no_disponible",
        severidad: "alta",
        mensaje:
          `El laboratorio se encuentra en estado "${laboratorio.estado}".`,
      });
    }

    if (inicioReal && finReal) {
      const pedidoExistente = await Pedido.findOne({
        _id: { $ne: pedido._id },
        laboratorio: pedido.laboratorio,
        fechaInicioReal: { $lt: finReal },
        fechaFinReal: { $gt: inicioReal },
        estado: {
          $in: ["Pendiente", "En Revisión", "Aceptado"],
        },
      });

      if (pedidoExistente) {
        conflictos.push({
          tipo: "laboratorio_ocupado",
          severidad: "alta",
          mensaje:
            "Ya existe un pedido para ese laboratorio en el horario solicitado (incluyendo el período de uso).",
        });
      }
    }
  }
  }

  // =========================
  // RECURSOS
  // =========================

  for (const r of pedido.recursos) {
    const ref = r.modeloRef || r.tipoRecurso;

    // =========================
    // EQUIPOS
    // =========================

    if (ref === "Equipo") {
      const equipo = await Equipo.findById(r.recursoId);

      if (!equipo) {
        conflictos.push({
          tipo: "equipo_no_existente",
          severidad: "alta",
          mensaje: "El equipo solicitado no existe",
        });

        continue;
      }

      let equipoConflictoDetectado = false;

      if (inicioReal && finReal) {
        // Delegamos la verificación temporal de los equipos a la Reserva, ignorando al pedido actual
        const reservaOcupando = await Reserva.findOne({
          pedidoId: { $ne: pedido._id },
          fechaInicioReal: { $lt: finReal },
          fechaFinReal: { $gt: inicioReal },
          estado: { $in: ['Pendiente', 'En Curso'] },
          "equiposReservados.equipoId": r.recursoId
        });

        if (reservaOcupando) {
          conflictos.push({
            tipo: "equipo_reservado",
            severidad: "alta",
            mensaje: `El equipo '${equipo.nombre}' ya se encuentra reservado en ese período.`,
          });
          equipoConflictoDetectado = true;
        }
      }

      if (!equipoConflictoDetectado && equipo.estado !== "disponible" && equipo.estado !== "reservado") {
        conflictos.push({
          tipo: "equipo_no_disponible",
          severidad: "alta",
          mensaje: `El equipo '${equipo.nombre}' no está operativo (Estado actual: ${equipo.estado}).`,
        });
      }
    }

    // =========================
    // ITEMS
    // =========================

    if (ref === "Item") {
      const stockDisponible =
        await Lote.calcularStockDisponible(
          r.recursoId
        );

      if (stockDisponible < r.cantidad) {
        conflictos.push({
          tipo: "stock_insuficiente",
          severidad: "alta",
          mensaje:
            `Stock insuficiente. ` +
            `Solicitado: ${r.cantidad}. ` +
            `Disponible: ${stockDisponible}.`,
        });
      }
    }
  }

  return conflictos;
};

export {
  verificarConflictos,
};