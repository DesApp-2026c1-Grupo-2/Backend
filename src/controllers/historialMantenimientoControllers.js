import Equipo from "../models/equipo.model.js";
import HistorialMantenimiento from "../models/historialMantenimiento.model.js";

/*
 * Registra un mantenimiento sobre un equipo y, en la misma operación, pasa el
 * equipo al estado "mantenimiento". El registro del historial es la fuente de
 * verdad (append-only); el estado del equipo es un reflejo operativo.
 *
 * No es transaccional: se inserta el historial primero (si falla, el equipo
 * queda intacto) y luego se actualiza el estado del equipo.
 */
const registrarMantenimiento = async (req, res) => {
  try {
    const { id } = req.params; // equipoId
    const { tipo, descripcion, fecha } = req.body;

    const equipo = await Equipo.findOne({ _id: id, activo: { $ne: false } });
    if (!equipo) {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    // Solo se puede iniciar mantenimiento sobre un equipo disponible.
    if (equipo.estado === "mantenimiento") {
      return res.status(409).json({
        error: "El equipo ya se encuentra en mantenimiento",
      });
    }
    if (equipo.estado === "fuera de servicio") {
      return res.status(409).json({
        error: "El equipo está fuera de servicio y no puede entrar en mantenimiento",
      });
    }

    const mantenimiento = await HistorialMantenimiento.create({
      equipoId: equipo._id,
      tipo,
      descripcion: descripcion ?? null,
      responsableId: req.usuario?.id ?? null,
      ...(fecha ? { fecha } : {}),
    });

    equipo.estado = "mantenimiento";
    await equipo.save();

    return res.status(201).json({
      message: "Mantenimiento registrado y equipo puesto en mantenimiento",
      equipo,
      mantenimiento,
    });
  } catch (err) {
    if (err.name === "ValidationError" || err.name === "CastError") {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({
      error: "Error al registrar el mantenimiento",
      detalles: err.message,
    });
  }
};

/*
 * Finaliza el mantenimiento abierto de un equipo: setea la fecha de `fin` del
 * registro y devuelve el equipo a "disponible". Gracias al bloqueo de
 * registrarMantenimiento, hay a lo sumo un mantenimiento abierto por equipo.
 */
const finalizarMantenimiento = async (req, res) => {
  try {
    const { id } = req.params; // equipoId

    const equipo = await Equipo.findOne({ _id: id, activo: { $ne: false } });
    if (!equipo) {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    if (equipo.estado !== "mantenimiento") {
      return res.status(409).json({
        error: "El equipo no se encuentra en mantenimiento",
      });
    }

    const mantenimiento = await HistorialMantenimiento.findOne({
      equipoId: equipo._id,
      fin: null,
    }).sort({ fecha: -1 });

    if (!mantenimiento) {
      return res.status(409).json({
        error: "No hay un mantenimiento abierto para este equipo",
      });
    }

    // El fin es el momento de finalización: lo fija el servidor. Como el inicio
    // siempre es <= ahora (se valida al registrar), fin >= inicio se cumple solo.
    mantenimiento.fin = new Date();
    await mantenimiento.save();

    equipo.estado = "disponible";
    await equipo.save();

    return res.json({
      message: "Mantenimiento finalizado y equipo puesto en disponible",
      equipo,
      mantenimiento,
    });
  } catch (err) {
    if (err.name === "ValidationError" || err.name === "CastError") {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({
      error: "Error al finalizar el mantenimiento",
      detalles: err.message,
    });
  }
};

/*
 * Historial de mantenimiento de un equipo, paginado y ordenado por fecha
 * descendente. Filtro opcional por tipo (preventivo/correctivo).
 */
const getHistorialMantenimiento = async (req, res) => {
  try {
    const { id } = req.params; // equipoId
    const { tipo, page, limit } = req.query;

    const filtros = { equipoId: id };
    if (tipo) filtros.tipo = tipo;

    const [registros, total] = await Promise.all([
      HistorialMantenimiento.find(filtros)
        .sort({ fecha: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("responsableId", "nombre apellido email rol"),
      HistorialMantenimiento.countDocuments(filtros),
    ]);

    return res.json({
      paginacion: {
        page,
        limit,
        total,
        totalPaginas: Math.ceil(total / limit),
      },
      registros,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res
        .status(400)
        .json({ error: "El ID proporcionado no tiene un formato válido." });
    }
    return res.status(500).json({
      error: "Error al obtener el historial de mantenimiento",
      detalles: err.message,
    });
  }
};

export {
  registrarMantenimiento,
  finalizarMantenimiento,
  getHistorialMantenimiento,
};
