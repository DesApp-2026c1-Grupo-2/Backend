import Pedido from "../models/pedido.model.js";
import Equipo from "../models/equipo.model.js";
import Laboratorio from "../models/laboratorio.model.js";
import Reserva from "../models/reserva.model.js";
import { calcularDisponibilidad } from "./disponibilidad.js";

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
    const laboratorio = await Laboratorio.findById(pedido.laboratorio);

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

      if (
        laboratorio.estado === "en mantenimiento" ||
        laboratorio.estado === "fuera de servicio"
      ) {
        conflictos.push({
          tipo: "laboratorio_no_disponible",
          severidad: "alta",
          mensaje: `El laboratorio se encuentra en estado "${laboratorio.estado}".`,
        });
      }

      if (inicioReal && finReal) {
        const pedidoExistente = await Pedido.findOne({
          _id: { $ne: pedido._id },
          laboratorio: pedido.laboratorio,
          fechaInicioReal: { $lt: finReal },
          fechaFinReal: { $gt: inicioReal },
          estado: {
            $in: ["Pendiente", "Aceptado"],
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

      // ----------------------------------------------------
      // NUEVA LOGICA: Validación de Equipos Fijos
      // ----------------------------------------------------
      if (equipo.esFijo) {
        const idLaboratorioPedido = pedido.laboratorio?._id?.toString() || pedido.laboratorio?.toString();
        const idLaboratorioEquipo = equipo.laboratorioId?._id?.toString() || equipo.laboratorioId?.toString() || equipo.laboratorio?._id?.toString() || equipo.laboratorio?.toString();

        // Regra 3: Impedir selección de equipos fijos sin laboratorio asociado
        if (!idLaboratorioEquipo) {
          conflictos.push({
            tipo: "equipo_fijo_sin_laboratorio",
            severidad: "alta",
            mensaje: `El equipo fijo "${equipo.nombre}" no tiene un laboratorio de origen asignado en el sistema.`,
          });
          continue; // Si no tiene lab de origen, saltamos las siguientes validaciones de lab
        }

        // Reglas 1 y 2: Equipos fijos de otro laboratorio / Incompatibilidades de asignación
        if (!idLaboratorioPedido || idLaboratorioEquipo !== idLaboratorioPedido) {
          conflictos.push({
            tipo: "incompatibilidad_equipo_fijo",
            severidad: "alta",
            mensaje: `El equipo "${equipo.nombre}" pertenece fijamente a otro laboratorio. No se puede asignar a este aula.`,
          });
        }
      }
      // ----------------------------------------------------

      let equipoConflictoDetectado = false;

      if (inicioReal && finReal) {
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
        inicioReal && finReal
          ? await calcularDisponibilidad(r.recursoId, inicioReal, finReal)
          : await calcularDisponibilidad(
              r.recursoId,
              new Date(0),
              new Date(8640000000000000)
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