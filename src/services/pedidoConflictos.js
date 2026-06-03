import Pedido from "../models/pedido.model.js";
import Equipo from "../models/equipo.model.js";
import Lote from "../models/lote.model.js";
import Laboratorio from "../models/laboratorio.model.js";
import Reserva from "../models/reserva.model.js";

const verificarConflictos = async (pedido) => {
  const conflictos = [];

  // =========================
  // LABORATORIO
  // =========================

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

    const pedidoExistente = await Pedido.findOne({
      _id: { $ne: pedido._id },
      laboratorio: pedido.laboratorio,
      fechaHora: pedido.fechaHora,
      estado: {
        $in: ["Pendiente", "En Revisión", "Aceptado"],
      },
    });

    if (pedidoExistente) {
      conflictos.push({
        tipo: "laboratorio_ocupado",
        severidad: "alta",
        mensaje:
          "Ya existe un pedido para ese laboratorio en el horario solicitado.",
      });
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

      // Delegamos la verificación temporal de los equipos a la Reserva, ignorando al pedido actual
      const reservaOcupando = await Reserva.findOne({
        pedidoId: { $ne: pedido._id },
        fechaHora: pedido.fechaHora,
        estado: { $in: ['Pendiente', 'En Curso'] },
        "equiposReservados.equipoId": r.recursoId
      });

      if (reservaOcupando) {
        conflictos.push({
          tipo: "equipo_reservado",
          severidad: "alta",
          mensaje: `El equipo '${equipo.nombre}' ya se encuentra reservado en ese horario.`,
        });
      } else if (equipo.estado !== "disponible" && equipo.estado !== "reservado") {
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