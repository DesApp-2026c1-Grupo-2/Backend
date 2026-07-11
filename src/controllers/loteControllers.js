import mongoose from "mongoose";
import Lote from "../models/lote.model.js";
import { registrarMovimiento, stockFisicoItem } from "../services/movimientoStock.service.js";
import { parsePaginacion } from "../utils/paginacion.js";

/*
 * Registro de historial en el CRUD de lotes (COMPRA/AJUSTE_MANUAL/BAJA).
 * A diferencia del descarte y el consumo del cron, estos endpoints NO son
 * transaccionales hoy, por lo que el movimiento se registra best-effort DESPUÉS
 * del cambio físico: si el insert del historial falla, el cambio de stock ya
 * quedó firme (mismo alcance de atomicidad que tenían estos endpoints antes de
 * existir el historial). Se loguea el fallo sin romper la respuesta.
 */
const registrarMovimientoLote = async (datos) => {
  try {
    await registrarMovimiento(datos);
  } catch (error) {
    console.error("[loteControllers] no se pudo registrar el movimiento de stock:", error.message);
  }
};

// C: Crear un nuevo lote
const createLote = async (req, res) => {
  try {
    const nuevoLote = new Lote(req.body);
    const loteGuardado = await nuevoLote.save();

    // COMPRA: alta de lote que ingresa stock físico (solo si nace disponible con
    // cantidad > 0; un lote creado ya descartado no mueve el agregado).
    if (loteGuardado.estado === "disponible" && loteGuardado.cantidadDisponible > 0) {
      const cantidadNueva = await stockFisicoItem(loteGuardado.itemId);
      await registrarMovimientoLote({
        itemId: loteGuardado.itemId,
        tipoMovimiento: "COMPRA",
        cantidad: loteGuardado.cantidadDisponible,
        cantidadAnterior: cantidadNueva - loteGuardado.cantidadDisponible,
        cantidadNueva,
        loteId: loteGuardado._id,
        usuarioId: req.usuario?.id,
        observacion: "Alta de lote"
      });
    }

    return res.status(201).json(loteGuardado);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// R: Obtener lotes (con filtros opcionales), ordenados FEFO.
// Shape compatible: devuelve un ARRAY por defecto; si llegan `page`/`limit`
// (p. ej. panel de descartados) devuelve `{ total, page, limit, lotes }`.
// El item se trae con nombre/código/tipo, igual que el populate anterior.
const getLotes = async (req, res) => {
  try {
    const { itemId, estado, ubicacion } = req.query;
    const filtros = { activo: { $ne: false } };

    if (itemId) filtros.itemId = new mongoose.Types.ObjectId(itemId);
    if (estado) filtros.estado = estado;
    if (ubicacion) filtros.ubicacion = ubicacion;

    // FEFO: lo que vence primero, arriba. `_sinVenc` empuja los lotes sin
    // fechaVencimiento al FINAL (Mongo, en orden ascendente, pondría los null
    // primero). Desempate por fechaCreacion, igual que la asignación de stock.
    const pipeline = [
      { $match: filtros },
      { $addFields: { _sinVenc: { $cond: [{ $gt: ["$fechaVencimiento", null] }, 0, 1] } } },
      { $sort: { _sinVenc: 1, fechaVencimiento: 1, fechaCreacion: 1 } },
    ];

    const paginado = req.query.page !== undefined || req.query.limit !== undefined;
    let page, limit;
    if (paginado) {
      const p = parsePaginacion(req.query, { def: 20, max: 100 });
      ({ page, limit } = p);
      pipeline.push({ $skip: p.skip }, { $limit: limit });
    }

    // $lookup + reshape del item a { id, nombre, codigo, tipo } y del lote a id.
    pipeline.push(
      { $lookup: { from: "items", localField: "itemId", foreignField: "_id", as: "_item" } },
      { $unwind: { path: "$_item", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          id: "$_id",
          itemId: {
            id: "$_item._id",
            nombre: "$_item.nombre",
            codigo: "$_item.codigo",
            tipo: "$_item.tipo",
          },
        },
      },
      { $project: { _sinVenc: 0, _item: 0, __v: 0 } },
    );

    const lotes = await Lote.aggregate(pipeline);

    if (paginado) {
      const total = await Lote.countDocuments(filtros);
      return res.status(200).json({ total, page, limit, lotes });
    }
    return res.status(200).json(lotes);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// R: Obtener un lote por su ID
const getLoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const lote = await Lote.findOne({ _id: id, activo: { $ne: false } })
      .populate('itemId', 'nombre codigo tipo');

    if (!lote) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }

    return res.status(200).json(lote);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// U: Actualizar un lote
const updateLote = async (req, res) => {
  try {
    const { id } = req.params;

    // Necesitamos el estado previo para calcular el delta físico del cambio.
    const loteAnterior = await Lote.findOne({ _id: id, activo: { $ne: false } });
    if (!loteAnterior) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }

    // Foto del agregado ANTES del update (definición canónica: stockFisicoItem).
    const stockAntes = await stockFisicoItem(loteAnterior.itemId);

    const loteActualizado = await Lote.findOneAndUpdate(
      { _id: id, activo: { $ne: false } },
      req.body,
      { new: true, runValidators: true }
    );

    // Registro de historial de CUALQUIER cambio del stock físico agregado, no solo
    // los ajustes de cantidad: también las transiciones de estado disponible↔
    // descartado (que entran/sacan el lote del agregado). El delta se calcula sobre
    // el agregado real (stockAntes vs stockDespues), de modo que el invariante
    // cantidadNueva = cantidadAnterior + cantidad se cumple sea cual sea el cambio.
    // (El cambio de itemId por PUT no es un caso soportado; si ocurriera, el delta
    // mezclaría dos items, por eso se omite el movimiento.)
    const mismoItem =
      String(loteAnterior.itemId) === String(loteActualizado.itemId);
    if (mismoItem) {
      const stockDespues = await stockFisicoItem(loteActualizado.itemId);
      const delta = stockDespues - stockAntes;

      const transicion = `${loteAnterior.estado}->${loteActualizado.estado}`;
      // BAJA: el lote sale del agregado (disponible→descartado).
      // AJUSTE_MANUAL: reingreso (descartado→disponible) o ajuste de cantidad
      // mientras sigue disponible. descartado→descartado no toca el agregado.
      const tipoPorTransicion = {
        "disponible->descartado": "BAJA",
        "descartado->disponible": "AJUSTE_MANUAL",
        "disponible->disponible": "AJUSTE_MANUAL",
      };
      const tipoMovimiento = tipoPorTransicion[transicion];

      if (tipoMovimiento && delta !== 0) {
        await registrarMovimientoLote({
          itemId: loteActualizado.itemId,
          tipoMovimiento,
          cantidad: delta,
          cantidadAnterior: stockAntes,
          cantidadNueva: stockDespues,
          loteId: loteActualizado._id,
          usuarioId: req.usuario?.id,
          observacion:
            tipoMovimiento === "BAJA"
              ? "Baja de lote (descarte vía edición)"
              : "Ajuste manual de lote"
        });
      }
    }

    return res.status(200).json(loteActualizado);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// D: Eliminar un lote
const deleteLote = async (req, res) => {
  try {
    const { id } = req.params;
    const loteEliminado = await Lote.findOneAndUpdate(
      { _id: id, activo: { $ne: false } },
      { activo: false },
      { new: true }
    );

    if (!loteEliminado) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }

    // BAJA: el lote deja de sumar al agregado. Si tenía stock disponible, ese
    // remanente es el egreso físico (cantidad negativa).
    if (loteEliminado.estado === "disponible" && loteEliminado.cantidadDisponible > 0) {
      const cantidadNueva = await stockFisicoItem(loteEliminado.itemId);
      await registrarMovimientoLote({
        itemId: loteEliminado.itemId,
        tipoMovimiento: "BAJA",
        cantidad: -loteEliminado.cantidadDisponible,
        cantidadAnterior: cantidadNueva + loteEliminado.cantidadDisponible,
        cantidadNueva,
        loteId: loteEliminado._id,
        usuarioId: req.usuario?.id,
        observacion: "Baja lógica de lote"
      });
    }

    return res.status(200).json({ message: "Lote marcado como eliminado (borrado lógico)", lote: loteEliminado });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export {
  createLote,
  getLotes,
  getLoteById,
  updateLote,
  deleteLote
};
