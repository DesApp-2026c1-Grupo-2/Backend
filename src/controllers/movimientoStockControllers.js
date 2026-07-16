import MovimientoStock from "../models/movimientoStock.model.js";
import { parsePaginacion } from "../utils/paginacion.js";

/*
 * Historial de movimientos de stock (consulta).
 * Ver docs/Diseno_Historial_Movimientos_Stock.md: todas las pantallas
 * (historial de descartes, movimientos por laboratorio, auditoría, etc.) se
 * construyen consultando esta única colección con filtros.
 *
 * El log de auditoría no tiene techo, por eso paginamos con default 50 y máx
 * 200 (ver utils/paginacion.js).
 */

export const getMovimientos = async (req, res) => {
  try {
    const { itemId, tipoMovimiento, reservaId, laboratorioId, desde, hasta } = req.query;

    const filtros = {};
    if (itemId) filtros.itemId = itemId;
    if (tipoMovimiento) filtros.tipoMovimiento = tipoMovimiento;
    if (reservaId) filtros.reservaId = reservaId;
    if (laboratorioId) {
      filtros.$or = [
        { origenLaboratorioId: laboratorioId },
        { destinoLaboratorioId: laboratorioId }
      ];
    }
    if (desde || hasta) {
      filtros.createdAt = {};
      if (desde) filtros.createdAt.$gte = new Date(desde);
      if (hasta) filtros.createdAt.$lte = new Date(hasta);
    }

    const { page, limit, skip } = parsePaginacion(req.query);

    const [movimientos, total] = await Promise.all([
      MovimientoStock.find(filtros)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("itemId", "nombre codigo unidad")
        .populate("usuarioId", "nombre apellido email")
        .populate("origenLaboratorioId", "nombre")
        .populate("destinoLaboratorioId", "nombre"),
      MovimientoStock.countDocuments(filtros)
    ]);

    return res.status(200).json({ total, page, limit, movimientos });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Conveniencia: historial de un item puntual (equivale a getMovimientos con ?itemId=).
export const getMovimientosPorItem = async (req, res) => {
  try {
    const { id } = req.params;
    const filtros = { itemId: id };
    const { page, limit, skip } = parsePaginacion(req.query);

    const [movimientos, total] = await Promise.all([
      MovimientoStock.find(filtros)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("usuarioId", "nombre apellido email")
        .populate("origenLaboratorioId", "nombre")
        .populate("destinoLaboratorioId", "nombre"),
      MovimientoStock.countDocuments(filtros)
    ]);

    return res.status(200).json({ total, page, limit, movimientos });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
