import Pedido from "../models/pedido.model.js";
import Laboratorio from "../models/laboratorio.model.js";
import Equipo from "../models/equipo.model.js";
import Item from "../models/item.model.js";
import Reserva from "../models/reserva.model.js";
import { calcularDisponibilidad } from "../services/disponibilidad.js";

const construirFechaHora = (data) => {
  if (data.fecha && data.hora) {
    return new Date(`${data.fecha}T${data.hora}`);
  }
  if (data.fechaHora) {
    return new Date(data.fechaHora);
  }
  return null;
};

const validarFechaHora = (fechaHora) => {
  if (!fechaHora || isNaN(fechaHora.getTime())) {
    throw new Error("La fecha y hora proporcionadas son inválidas");
  }
};

const validarConflictoLaboratorio = async (data, fechaHora, pedidoId, duracionClase) => {
  if (!data.laboratorio) return null;

  const inicioReal = new Date(fechaHora.getTime() - 60 * 60 * 1000);
  const finReal = new Date(fechaHora.getTime() + (duracionClase + 30) * 60 * 1000);

  const filtroConflicto = {
    laboratorio: data.laboratorio,
    fechaInicioReal: { $lt: finReal },
    fechaFinReal: { $gt: inicioReal },
    estado: { $ne: "Rechazado" },
    activo: { $ne: false },
  };

  if (pedidoId) {
    filtroConflicto._id = { $ne: pedidoId };
  }

  const existe = await Pedido.findOne(filtroConflicto);
  if (existe) {
    return "El laboratorio ya está ocupado en ese horario por una reserva con superposición.";
  }
  return null;
};

const validarLaboratorioCapacidad = async (data) => {
  if (!data.laboratorio) return null;

  const laboratorio = await Laboratorio.findById(data.laboratorio);

  if (!laboratorio) {
    return "El laboratorio solicitado no existe en la base de datos.";
  }

  if (typeof data.alumnos === "number" && data.alumnos > laboratorio.capacidad) {
    return `El laboratorio no tiene capacidad suficiente (Máximo: ${laboratorio.capacidad} alumnos).`;
  }

  return null;
};

const validarRecursos = async (data, fechaHora, duracionClase) => {
  const detalles = [];
  const inicioReal = new Date(fechaHora.getTime() - 60 * 60 * 1000);
  const finReal = new Date(fechaHora.getTime() + (duracionClase + 30) * 60 * 1000);

  if (!Array.isArray(data.recursos)) {
    data.recursos = [];
  }

  for (const recurso of data.recursos) {

    if (
      !recurso.tipoRecurso ||
      !recurso.recursoId ||
      !recurso.cantidad
    ) {
      detalles.push(
        "Cada recurso debe incluir tipoRecurso, recursoId y cantidad."
      );
      continue;
    }

    if (recurso.tipoRecurso === "Equipo") {

      const equipo = await Equipo.findById(recurso.recursoId);

      if (!equipo) {
        detalles.push(
          "Uno de los equipos solicitados no existe."
        );
        continue;
      }

      const reservaOcupando = await Reserva.findOne({
        "equiposReservados.equipoId": recurso.recursoId,
        estado: { $in: ["Pendiente", "En Curso"] },
        fechaInicioReal: { $lt: finReal },
        fechaFinReal: { $gt: inicioReal },
      });

      if (reservaOcupando) {
        detalles.push(
          `El equipo '${equipo.nombre}' ya está reservado y en uso durante ese período.`
        );
      }

      if (
        equipo.estado !== "disponible" &&
        equipo.estado !== "reservado"
      ) {
        detalles.push(
          `El equipo '${equipo.nombre}' no está operativo.`
        );
      }

      continue;
    }

    if (recurso.tipoRecurso === "Item") {

      const item = await Item.findById(recurso.recursoId);

      if (!item) {
        detalles.push(
          "Uno de los ítems solicitados no existe."
        );
        continue;
      }

      // Disponibilidad por rango horario (docs/stock-disponibilidad-temporal.md §3),
      // consistente con verificarConflictos y con el gate de aprobación. Usar el
      // stock nominal (Lote.calcularStockDisponible) ignoraba las reservas que
      // solapan la ventana del pedido.
      const stockDisponible = await calcularDisponibilidad(
        recurso.recursoId,
        inicioReal,
        finReal
      );

      if (stockDisponible < recurso.cantidad) {
        detalles.push(
          `Stock insuficiente de '${item.nombre}'. Solicitado: ${recurso.cantidad}, Disponible: ${stockDisponible}.`
        );
      }

      continue;
    }

    detalles.push(
      `Tipo de recurso no válido: ${recurso.tipoRecurso}`
    );
  }

  return detalles;
};

export const validarPedido = async (req, res, next) => {
  try {
    const data = req.body;
    const detalleProblemas = [];

    // Validación de seguridad: un docente solo puede crear pedidos a su propio nombre
    if (req.usuario && req.usuario.rol === "DOCENTE") {
      if (data.docente && data.docente.toString() !== req.usuario.id.toString()) {
        throw new Error("No estás autorizado para crear pedidos a nombre de otro docente.");
      }
    }

    const fechaHora = construirFechaHora(data);

    if (!fechaHora || isNaN(fechaHora.getTime())) {
      return res.status(400).json({
        error: "fechaHora inválida",
        debug: data
      });
    }

    // Guardar la fechaHora construida en req.body para que el controller la use
    req.body.fechaHora = fechaHora;

    // Eliminar las propiedades originales para evitar conflictos con validaciones
    // posteriores (ej. Joi.xor() en pedidoSchema)
    delete data.fecha;
    delete data.hora;

    if (!data.duracionClase || isNaN(Number(data.duracionClase))) {
      throw new Error("El campo 'duracionClase' es obligatorio y debe ser un número en minutos.");
    }
    const duracionClaseNum = Number(data.duracionClase);
    req.body.duracionClase = duracionClaseNum;

    if (!data.laboratorio) {
      data.laboratorio = null;
      req.body.laboratorio = null;
    }

    const conflicto = await validarConflictoLaboratorio(data, fechaHora, req.params.id, duracionClaseNum);
    if (conflicto) detalleProblemas.push(conflicto);

    const problemaLaboratorio = await validarLaboratorioCapacidad(data);
    if (problemaLaboratorio) detalleProblemas.push(problemaLaboratorio);

    const recursosProblemas = await validarRecursos(data, fechaHora, duracionClaseNum);
    detalleProblemas.push(...recursosProblemas);

    req.detalleProblemas = detalleProblemas;
    req.estadoCalculado = detalleProblemas.length > 0 ? "En Revisión" : "Pendiente";

    next();
  } catch (error) {
    res.status(400).json({ 
      error: "Error de validación", 
      detalles: [{ message: error.message, path: ["general"] }],
      errors: [{ message: error.message, path: ["general"] }]
    });
  }
};


export const puedeEditarPedido = async (req, res, next) => {
  try {
    const { rol, id: usuarioId } = req.usuario;
    const { id: pedidoId } = req.params;

    const pedido = await Pedido.findById(pedidoId);

    if (!pedido) {
      return res.status(404).json({
        error: "Pedido no encontrado"
      });
    }

    // Solo pedidos pendientes
    if (pedido.estado !== "Pendiente") {
      return res.status(403).json({
        error: "Solo se pueden editar pedidos pendientes"
      });
    }

    // Admin y personal pueden editar cualquiera
    if (rol === "ADMIN" || rol === "PERSONAL") {
      return next();
    }

    // Docente solo sus propios pedidos
    if (
      rol === "DOCENTE" &&
      pedido.docente.toString() === usuarioId
    ) {
      return next();
    }

    return res.status(403).json({
      error: "No autorizado"
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
};