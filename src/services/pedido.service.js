import mongoose from "mongoose";
import Pedido from "../models/pedido.model.js";
import Equipo from "../models/equipo.model.js";
import Item from "../models/item.model.js";
import Lote from "../models/lote.model.js";
import Reserva from "../models/reserva.model.js";
import { verificarConflictos } from "./pedidoConflictos.js";
import { calcularVentana } from "./fechasReserva.js";
import {
  aprobarConReserva,
  asignarLotesFIFO,
  ConflictoStockError,
  soportaTransacciones,
} from "./aprobacionReserva.js";
import { validarAnticipacionPedido } from "./pedidoValidaciones.js";
import { registrarHistorial } from "./pedidoHistorial.js";
import { registrarDescarteService } from "./descarte.service.js";
import { aplicarDevolucionesFinalizacion, validarConsumosRequeridos, validarDescartesReutilizables } from "./devolucionReserva.js";

// ─── Populate estándar reutilizable ──────────────────────────────────────────
const POPULATE_PEDIDO = [
  { path: "docente", select: "nombre apellido email" },
  { path: "laboratorio", select: "nombre tipo" },
  {
    path: "recursos.recursoId",
    select: "nombre tipo codigo esFijo estado esConsumible laboratorio",
  },
  { path: "comentarios.usuario", select: "nombre apellido rol" },
];

// ─── Obtener todos los pedidos ────────────────────────────────────────────────
export const getPedidosService = async (usuario) => {
  const { id, rol } = usuario;

  const filtro = { activo: { $ne: false } };
  if (rol === "DOCENTE") filtro.docente = id;

  // Actualizar automáticamente a "Expirado" pedidos pendientes cuya fechaHora ya pasó
  await Pedido.updateMany(
    { estado: "Pendiente", fechaHora: { $lt: new Date() } },
    { $set: { estado: "Expirado" } }
  );

  const pedidos = await Pedido.find(filtro)
    .populate("docente", "nombre apellido email")
    .populate("laboratorio", "nombre tipo")
    .populate({ path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado esConsumible laboratorio" })
    .populate({ path: "comentarios.usuario", select: "nombre apellido rol" })
    .sort({ fechaHora: -1 });

  return pedidos.map((p) => {
    const ultimoComentario = p.comentarios?.[p.comentarios.length - 1];
    const visto = p.vistoPor?.find((v) => v.usuario?.toString() === id);
    const ultimoVisto = visto?.ultimoComentarioVisto;
    const hayNoVistos =
      ultimoComentario &&
      (!ultimoVisto || new Date(ultimoComentario.createdAt) > new Date(ultimoVisto));

    return { ...p.toObject(), tieneComentariosNuevos: hayNoVistos };
  });
};

// ─── Obtener pedido por ID ────────────────────────────────────────────────────
export const getPedidoByIdService = async (pedidoId, usuario) => {
  const { id: userId, rol } = usuario;

  // Actualizar automáticamente a "Expirado" si es pendiente y su fechaHora ya pasó
  await Pedido.updateMany(
    { _id: pedidoId, estado: "Pendiente", fechaHora: { $lt: new Date() } },
    { $set: { estado: "Expirado" } }
  );

  const pedido = await Pedido.findById(pedidoId)
    .populate("docente", "nombre apellido email")
    .populate("laboratorio", "nombre tipo")
    .populate({ path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado esConsumible laboratorio" })
    .populate({ path: "comentarios.usuario", select: "nombre apellido rol" })
    .populate({ path: "historial.usuario", select: "nombre apellido rol" });

  if (!pedido) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });

  if (rol === "DOCENTE" && pedido.docente._id.toString() !== userId) {
    throw Object.assign(new Error("No autorizado"), { status: 403 });
  }

  const conflictos = await verificarConflictos(pedido);

  return { ...pedido.toObject(), conflictos };
};

// ─── Crear pedido ─────────────────────────────────────────────────────────────
export const createPedidoService = async (body, usuario, extras = {}) => {
  const { fecha, hora, fechaInicioReal, fechaFinReal, ...resto } = body;

  const fechaHora = body.fechaHora;

  if (!fechaHora) throw Object.assign(new Error("fechaHora es obligatorio"), { status: 400 });

  if (!validarAnticipacionPedido(fechaHora)) {
    throw Object.assign(
      new Error("No se pueden crear pedidos con menos de 2 horas de anticipación el mismo día o en fechas pasadas"),
      { status: 400 }
    );
  }

  if (!resto.duracionClase) {
    throw Object.assign(new Error("duracionClase es obligatorio"), { status: 400 });
  }

  if (!Array.isArray(resto.recursos)) resto.recursos = [];

  const { inicio, fin } = calcularVentana(fechaHora, resto.duracionClase);

  const pedido = new Pedido({
    ...resto,
    fechaHora,
    fechaInicioReal: inicio,
    fechaFinReal: fin,
    detalleProblemas: extras.detalleProblemas || [],
    estado: extras.estadoCalculado || "Pendiente",
  });

  registrarHistorial(pedido, usuario.id, "CREACION", "Pedido creado");

  const nuevo = await pedido.save();
  await nuevo.populate(POPULATE_PEDIDO.slice(0, 3));

  return nuevo;
};

// ─── Actualizar pedido ────────────────────────────────────────────────────────
export const updatePedidoService = async (pedidoId, body, usuario) => {
  const { fecha, hora, ...resto } = body;

  const actualizacion = { ...resto };

  if (fecha && hora) {
    actualizacion.fechaHora = new Date(`${fecha}T${hora}`);
  } else if (body.fechaHora) {
    actualizacion.fechaHora = new Date(body.fechaHora);
  }

  const pedidoDoc = await Pedido.findById(pedidoId);
  if (!pedidoDoc) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });

  const pedidoExistente = pedidoDoc.toObject();
  const fechaBase = actualizacion.fechaHora || pedidoExistente.fechaHora;

  if (fechaBase && !validarAnticipacionPedido(new Date(fechaBase))) {
    throw Object.assign(
      new Error("No se pueden actualizar pedidos con menos de 2 horas de anticipación el mismo día o en fechas pasadas"),
      { status: 400 }
    );
  }

  const duracionBase = actualizacion.duracionClase || pedidoExistente.duracionClase;
  if (fechaBase && duracionBase) {
    const { inicio, fin } = calcularVentana(new Date(fechaBase), duracionBase);
    actualizacion.fechaInicioReal = inicio;
    actualizacion.fechaFinReal = fin;
  }

  // ── Detectar cambios para historial ──
  const normalize = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "object" && v._id) return v._id.toString();
    return JSON.stringify(v);
  };

  const cambios = {};
  const camposSimples = ["materia", "alumnos", "duracionClase", "fechaHora"];

  for (const campo of camposSimples) {
    if (actualizacion[campo] === undefined) continue;
    if (normalize(pedidoExistente[campo]) !== normalize(actualizacion[campo])) {
      cambios[campo] = { antes: pedidoExistente[campo], despues: actualizacion[campo] };
    }
  }

  if (actualizacion.laboratorio !== undefined && normalize(pedidoExistente.laboratorio) !== normalize(actualizacion.laboratorio)) {
    const Laboratorio = (await import("../models/laboratorio.model.js")).default;
    const [labAntes, labDespues] = await Promise.all([
      pedidoExistente.laboratorio ? Laboratorio.findById(pedidoExistente.laboratorio, "nombre") : null,
      actualizacion.laboratorio ? Laboratorio.findById(actualizacion.laboratorio, "nombre") : null
    ]);
    cambios.laboratorio = {
      antes: labAntes ? labAntes.nombre : (pedidoExistente.laboratorio || "—"),
      despues: labDespues ? labDespues.nombre : (actualizacion.laboratorio || "—")
    };
  }

  if (actualizacion.fechaInicioReal && actualizacion.fechaFinReal) {
    const antes = { inicio: pedidoExistente.fechaInicioReal, fin: pedidoExistente.fechaFinReal };
    const despues = { inicio: actualizacion.fechaInicioReal, fin: actualizacion.fechaFinReal };
    if (
      new Date(antes.inicio).getTime() !== new Date(despues.inicio).getTime() ||
      new Date(antes.fin).getTime() !== new Date(despues.fin).getTime()
    ) {
      cambios.horario = { antes, despues };
    }
  }

  if (actualizacion.recursos) {
    // 1. Recopilamos IDs únicos (viejos y nuevos)
    const idsRecursos = [...new Set([
      ...(pedidoExistente.recursos || []).map(r => r.recursoId?.toString?.() || r.recursoId),
      ...(actualizacion.recursos || []).map(r => r.recursoId?.toString?.() || r.recursoId)
    ].filter(Boolean))];

    // 2. Buscamos los nombres en lote para no afectar el rendimiento
    const [equipos, items] = await Promise.all([
      Equipo.find({ _id: { $in: idsRecursos } }, 'nombre'),
      Item.find({ _id: { $in: idsRecursos } }, 'nombre')
    ]);
    
    const mapaNombres = {};
    equipos.forEach(e => mapaNombres[e._id.toString()] = e.nombre);
    items.forEach(i => mapaNombres[i._id.toString()] = i.nombre);

    // 3. Normalizamos inyectando el nombre directamente
    const norm = (r) => {
      const idStr = r.recursoId?.toString?.() || r.recursoId;
      return {
        recursoId: idStr,
        nombre: mapaNombres[idStr] || "Recurso eliminado/desconocido",
        tipoRecurso: r.tipoRecurso,
        cantidad: r.cantidad,
      };
    };

    const antesR = (pedidoExistente.recursos || []).map(norm);
    const despuesR = (actualizacion.recursos || []).map(norm);
    
    if (JSON.stringify(antesR) !== JSON.stringify(despuesR)) {
      cambios.recursos = { antes: antesR, despues: despuesR };
    }
  }

  if (Object.keys(cambios).length > 0) {
    registrarHistorial(pedidoDoc, usuario.id, "MODIFICACION", "Se modificó el pedido", cambios);
  }

  Object.assign(pedidoDoc, actualizacion);
  await pedidoDoc.save();

  await pedidoDoc.populate("docente", "nombre apellido email");
  await pedidoDoc.populate("laboratorio", "nombre tipo");
  await pedidoDoc.populate({ path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado esConsumible laboratorio" });

  return pedidoDoc;
};

// ─── Aprobar pedido ───────────────────────────────────────────────────────────
export const aprobarPedidoService = async (pedidoId, usuario) => {
  const pedido = await Pedido.findById(pedidoId);
  if (!pedido) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });

  if (pedido.estado !== "Pendiente") {
    throw Object.assign(
      new Error("El pedido ya fue aceptado previamente y sus recursos ya fueron descontados."),
      { status: 400 }
    );
  }

  await Reserva.deleteOne({ pedidoId: pedido._id });

  const conflictos = await verificarConflictos(pedido);
  const conflictosGraves = conflictos.filter((c) => c.severidad === "alta");

  if (conflictosGraves.length > 0) {
    throw Object.assign(
      Object.assign(new Error("El pedido tiene conflictos"), { conflictos }),
      { status: 400 }
    );
  }

  const checklist = [];
  let requiereCarrito = false;
  const equiposReservados = [];
  const materialesReservados = [];

  for (const r of pedido.recursos) {
    const ref = r.modeloRef || r.tipoRecurso;

    if (ref === "Equipo") {
      requiereCarrito = true;
      checklist.push({ descripcion: "Acondicionar equipo reservado y verificar su funcionamiento.", tipo: "Logistica" });
      equiposReservados.push({ equipoId: r.recursoId });
    } else if (ref === "Item") {
      const item = await Item.findById(r.recursoId);
      if (item) {
        requiereCarrito = true;
        if (item.tipo === "reactivo") {
          checklist.push(
            item.requiereReceta
              ? { descripcion: `Preparar reactivo a partir de sustancias base: ${item.nombre}.`, tipo: "Preparacion" }
              : { descripcion: `Asegurar disponibilidad del reactivo: ${item.nombre}. Gestionar compra si el stock base es bajo.`, tipo: "Compra" }
          );
        } else if (item.tipo === "material") {
          checklist.push({ descripcion: `Acondicionar material: ${item.nombre}.`, tipo: "Logistica" });
        }
      }

      const lotesUsados = await asignarLotesFIFO(r.recursoId, r.cantidad);
      materialesReservados.push({ itemId: r.recursoId, cantidadTotal: r.cantidad, lotesUsados });
    }
  }

  if (requiereCarrito) {
    checklist.push({ descripcion: "Colocar todos los materiales, equipos y reactivos en los carritos destinados al aula.", tipo: "General" });
  }

  const { inicio, fin } = calcularVentana(pedido.fechaHora, pedido.duracionClase);
  let nuevaReserva;

  try {
    nuevaReserva = await aprobarConReserva({
      datosReserva: {
        pedidoId: pedido._id,
        laboratorioId: pedido.laboratorio,
        docenteId: pedido.docente,
        fechaHora: pedido.fechaHora,
        duracionClase: pedido.duracionClase,
        equiposReservados,
        materialesReservados,
      },
      materiales: materialesReservados,
      inicio,
      fin,
    });
  } catch (error) {
    if (error instanceof ConflictoStockError) {
      throw Object.assign(
        new Error("El pedido tiene conflictos"),
        {
          status: 400,
          conflictos: [{ tipo: "stock_insuficiente", severidad: "alta", mensaje: error.message }],
        }
      );
    }
    throw error;
  }

  pedido.estado = "Aceptado";
  registrarHistorial(pedido, usuario.id, "APROBACION", "Pedido aprobado", {
    estado: { antes: "Pendiente", despues: "Aceptado" },
  });
  pedido.checklist = checklist;

  let pedidoAprobado;
  try {
    pedidoAprobado = await pedido.save();
  } catch (saveErr) {
    await Reserva.deleteOne({ _id: nuevaReserva._id });
    throw saveErr;
  }

  await pedidoAprobado.populate([
    { path: "docente", select: "nombre apellido email" },
    { path: "laboratorio", select: "nombre tipo" },
    { path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado esConsumible laboratorio" },
  ]);

  return { pedido: pedidoAprobado, reservaId: nuevaReserva._id };
};

// ─── Finalizar pedido ─────────────────────────────────────────────────────────
export const finalizarPedidoService = async (pedidoId, body, usuario) => {
  const { descartes = [], desperfectos = [], consumos = [] } = body;

  const pedido = await Pedido.findById(pedidoId);
  if (!pedido) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });

  if (pedido.estado !== "Aceptado") {
    throw Object.assign(
      new Error("El pedido debe estar en estado 'Aceptado' para poder finalizarse."),
      { status: 400 }
    );
  }

  // Exigir el consumo reportado de todo consumible cuyo stock ya salió físicamente
  // y siga sin liquidar, ANTES de tocar descartes/stock. Si falta, aborta con 400
  // sin efectos colaterales.
  //
  // Deliberadamente NO se filtra por estado de la reserva: el estado lo mueve un
  // cron cada minuto, así que mirarlo hacía que el mismo pedido exigiera el consumo
  // o no según el minuto en que se apretara "Finalizar", y que finalizarlo después
  // de que el cron cerrara la reserva perdiera el sobrante en silencio. La
  // exigencia la decide el dato físico (ver requiereConsumoReportado).
  const reserva = await Reserva.findOne({ pedidoId: pedido._id });
  if (reserva) {
    await validarConsumosRequeridos(reserva, consumos);
  }

  // Fail-fast: el descarte solo aplica a reutilizables. Validamos ANTES del loop
  // de descartes porque registrarDescarteService commitea por descarte y no
  // queremos dejar descartes parciales si alguno apunta a un consumible.
  await validarDescartesReutilizables(descartes);

  const detalleProblemas = [...(pedido.detalleProblemas || [])];

  for (const descarte of descartes) {
    const tipo = descarte.tipo || "material";
    const payload = {
      pedidoId,
      tipo,
      itemId: descarte.itemId,
      equipoId: descarte.equipoId,
      cantidad: Number(descarte.cantidad || 1),
      motivo: descarte.motivo || "Finalización de pedido",
    };

    await registrarDescarteService(payload, usuario);

    detalleProblemas.push(
      tipo === "equipo"
        ? `Desperfecto - Equipo ID: ${descarte.equipoId} enviado a mantenimiento.`
        : `Descarte - ${tipo}: ${descarte.itemId}, Cantidad: ${payload.cantidad}, Motivo: ${payload.motivo}`
    );
  }

  for (const desperfecto of desperfectos) {
    const equipoId = typeof desperfecto === "string" ? desperfecto : desperfecto?.equipoId;
    const motivo =
      typeof desperfecto === "string"
        ? "Desperfecto informado al finalizar el pedido"
        : desperfecto?.motivo || "Desperfecto informado al finalizar el pedido";

    if (!equipoId) continue;

    await registrarDescarteService({ pedidoId, tipo: "equipo", equipoId, cantidad: 1, motivo }, usuario);
    detalleProblemas.push(`Desperfecto - Equipo ID: ${equipoId} enviado a mantenimiento.`);
  }

  pedido.detalleProblemas = detalleProblemas;
  pedido.estado = "Finalizado";

  // AGREGAR ESTE BLOQUE PARA CAPTURAR NOMBRES (SNAPSHOT) 👇
  const descartesSnapshot = await Promise.all(descartes.map(async (d) => {
    const id = d.itemId || d.equipoId;
    let nombre = "Desconocido";
    if (id) {
      const model = d.tipo === "equipo" ? Equipo : Item;
      const doc = await model.findById(id, 'nombre');
      if (doc) nombre = doc.nombre;
    }
    return { ...d, nombre };
  }));

  const desperfectosSnapshot = await Promise.all(desperfectos.map(async (d) => {
    const id = typeof d === "string" ? d : d?.equipoId;
    let nombre = "Equipo Desconocido";
    if (id) {
      const doc = await Equipo.findById(id, 'nombre');
      if (doc) nombre = doc.nombre;
    }
    return typeof d === "string" 
      ? { equipoId: id, nombre, motivo: "Desperfecto informado al finalizar el pedido" } 
      : { ...d, nombre };
  }));
  // 👆 HASTA ACÁ

  // MODIFICAR EL REGISTRO DE HISTORIAL PARA USAR LOS SNAPSHOTS:
  registrarHistorial(pedido, usuario.id, "FINALIZACION", "Pedido finalizado con reporte de uso.", {
    estado: { antes: "Aceptado", despues: "Finalizado" },
    reporteFinal: { descartes: descartesSnapshot, desperfectos: desperfectosSnapshot },
  });

  const pedidoFinalizado = await pedido.save();

  // Finalizar la reserva asociada CON devolución de stock (reutilizables 100% y
  // sobrante de consumibles según `consumos`), en transacción si se soporta.
  //
  // La liquidación es data-driven: devuelve lo que salió y no se saldó, sin
  // importar si la reserva está Pendiente, En Curso, Finalizada (por el cron) o en
  // Conflicto. Antes se reclamaba con `{ estado: "En Curso" }` y, si no la
  // encontraba, solo se seteaba "Finalizada" sin devolver nada: finalizar un pedido
  // después de que el cron cerrara la reserva perdía el sobrante de los consumibles.
  //
  // Ya no hace falta el claim atómico por estado: la idempotencia se apoya en
  // `liquidado` (por material) y el `save` dentro de la transacción serializa
  // contra el cron.
  const finalizarReservaAsociada = async (session) => {
    const opts = session ? { session } : {};
    const reserva = await Reserva.findOne({ pedidoId: pedido._id }, null, opts);
    if (!reserva) return;
    // Estado terminal: la cancelación ya repuso su stock. Ni se liquida ni se pisa.
    if (reserva.estado === "Cancelada") return;
    await aplicarDevolucionesFinalizacion(reserva, {
      consumos,
      usuarioId: usuario.id,
      session,
    });
    reserva.estado = "Finalizada";
    await reserva.save(opts);
  };

  if (await soportaTransacciones()) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await finalizarReservaAsociada(session);
      });
    } finally {
      await session.endSession();
    }
  } else {
    await finalizarReservaAsociada(null);
  }

  await pedidoFinalizado.populate([
    { path: "docente", select: "nombre apellido email" },
    { path: "laboratorio", select: "nombre tipo" },
    { path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado esConsumible" },
  ]);

  return pedidoFinalizado;
};

// ─── Actualizar estado ────────────────────────────────────────────────────────
export const updateEstadoService = async (pedidoId, body, usuario) => {
  const { estado, motivoRechazo } = body;

  const estadosValidos = ["Pendiente", "Aceptado", "Rechazado", "Finalizado", "Cancelado", "Expirado"];
  if (!estadosValidos.includes(estado)) {
    throw Object.assign(new Error("Estado no válido"), { status: 400 });
  }

  const pedido = await Pedido.findById(pedidoId);
  if (!pedido) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });

  if (pedido.estado === estado) {
    throw Object.assign(new Error("El pedido ya tiene ese estado"), { status: 400 });
  }

  const estadoAnterior = pedido.estado;

  if (estado === "Cancelado") {
    if (!["Pendiente", "Aceptado"].includes(estadoAnterior)) {
      throw Object.assign(
        new Error("Solo se pueden cancelar pedidos en estado Pendiente o Aceptado."),
        { status: 400 }
      );
    }

    if (estadoAnterior === "Aceptado") {
      const reserva = await Reserva.findOne({ pedidoId: pedido._id });
      if (reserva) {
        if (reserva.estado === "En Curso") {
          for (const material of reserva.materialesReservados || []) {
            const item = await Item.findById(material.itemId);
            if (!item || item.esConsumible !== true) continue;
            for (const lote of material.lotesUsados || []) {
              await Lote.findByIdAndUpdate(lote.loteId, { $inc: { cantidadDisponible: lote.cantidad } });
            }
          }
        }
        for (const eq of reserva.equiposReservados || []) {
          await Equipo.findByIdAndUpdate(eq.equipoId, { estado: "disponible" });
        }
        await Reserva.findOneAndUpdate({ pedidoId: pedido._id }, { estado: "Cancelada" });
      }
    }
  }

  pedido.estado = estado;
  if (estado === "Rechazado") {
    pedido.motivoRechazo = motivoRechazo || "Sin motivo especificado";
  }

  let mensajeHistorial = `Estado cambiado de "${estadoAnterior}" a "${estado}"`;
  
  if (estado === "Cancelado") {
    if (estadoAnterior === "Aceptado") {
      mensajeHistorial += ". Se canceló el pedido y se liberaron las reservas, el stock y el equipamiento asociado.";
    } else {
      mensajeHistorial += ". El pedido fue cancelado antes de ser aprobado, por lo que no requirió liberar reservas.";
    }
  } else if (estado === "Rechazado") {
    mensajeHistorial += `. Motivo: ${pedido.motivoRechazo}`;
  }

  registrarHistorial(
    pedido,
    usuario.id,
    "CAMBIO_ESTADO",
    mensajeHistorial,
    { estado: { antes: estadoAnterior, despues: estado } }
  );

  await pedido.save();

  await pedido.populate([
    { path: "docente", select: "nombre apellido email" },
    { path: "laboratorio", select: "nombre tipo" },
    { path: "recursos.recursoId", select: "nombre tipo codigo esFijo estado esConsumible laboratorio" },
  ]);

  return pedido;
};

// ─── Borrado lógico ───────────────────────────────────────────────────────────
export const borrarPedidoLogicoService = async (pedidoId, usuario) => {
  const pedido = await Pedido.findById(pedidoId);
  if (!pedido) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });

  pedido.activo = false;
  registrarHistorial(pedido, usuario.id, "ELIMINACION", "Pedido eliminado lógicamente");
  await pedido.save();

  return pedido;
};

// ─── Agregar comentario ───────────────────────────────────────────────────────
export const agregarComentarioService = async (pedidoId, mensaje, usuario) => {
  const pedido = await Pedido.findById(pedidoId);
  if (!pedido) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });

  pedido.comentarios.push({ usuario: usuario.id, mensaje });
  registrarHistorial(pedido, usuario.id, "COMENTARIO", "Se agregó un comentario");
  await pedido.save();

  const pedidoActualizado = await Pedido.findById(pedidoId).populate({
    path: "comentarios.usuario",
    select: "nombre apellido rol",
  });

  return pedidoActualizado.comentarios[pedidoActualizado.comentarios.length - 1];
};

// ─── Marcar comentarios vistos ────────────────────────────────────────────────
export const marcarComentariosVistosService = async (pedidoId, userId) => {
  const ahora = new Date();
  const pedido = await Pedido.findById(pedidoId);
  if (!pedido) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });

  const idx = pedido.vistoPor.findIndex((v) => v.usuario.toString() === userId);
  if (idx >= 0) {
    pedido.vistoPor[idx].ultimoComentarioVisto = ahora;
  } else {
    pedido.vistoPor.push({ usuario: userId, ultimoComentarioVisto: ahora });
  }

  await Pedido.updateOne({ _id: pedidoId }, { $set: { vistoPor: pedido.vistoPor } });
};

// ─── Actualizar checklist ─────────────────────────────────────────────────────
export const updateChecklistService = async (pedidoId, checklist) => {
  const pedido = await Pedido.findByIdAndUpdate(
    pedidoId,
    { $set: { checklist } },
    { new: true }
  )
    .populate("docente")
    .populate("laboratorio");

  if (!pedido) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });

  return pedido;
};
