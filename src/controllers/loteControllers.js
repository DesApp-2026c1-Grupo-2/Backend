import mongoose from "mongoose";
import Lote from "../models/lote.model.js";
import { registrarMovimiento, stockFisicoItem } from "../services/movimientoStock.service.js";
import { soportaTransacciones } from "../services/aprobacionReserva.js";
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

// Divide un lote: decrementa `cantidad` del origen y crea un lote NUEVO en el destino
// con esa porción. Ambas operaciones deben ser atómicas para no perder/duplicar stock,
// por eso se envuelven en una transacción si la conexión la soporta (mismo patrón que
// aprobacionReserva/cronReservas); en standalone corre degradado sin sesión. El lote
// destino hereda itemId/ubicacion/fechaCreacion/fechaVencimiento para no alterar el
// orden FEFO/FIFO del stock. Devuelve el lote destino creado.
const moverLoteParcial = async (lote, cantidad, destino) => {
  const ejecutar = async (session) => {
    const opts = session ? { session } : {};
    await Lote.updateOne(
      { _id: lote._id },
      { $inc: { cantidadDisponible: -cantidad } },
      opts
    );
    const [loteDestino] = await Lote.create(
      [{
        itemId: lote.itemId,
        cantidadDisponible: cantidad,
        ubicacion: lote.ubicacion,
        laboratorioId: destino,
        estado: "disponible",
        fechaCreacion: lote.fechaCreacion,
        fechaVencimiento: lote.fechaVencimiento,
      }],
      opts
    );
    return loteDestino;
  };

  if (!(await soportaTransacciones())) {
    return ejecutar(null);
  }
  const session = await mongoose.startSession();
  try {
    let loteDestino;
    await session.withTransaction(async () => {
      loteDestino = await ejecutar(session);
    });
    return loteDestino;
  } finally {
    await session.endSession();
  }
};

// Transferir un lote entre depósito y laboratorios (o devolverlo al depósito).
// `laboratorioDestinoId === null` => DEVOLUCION (vuelve al depósito);
// cualquier otro destino => TRANSFERENCIA.
//
// `cantidad` (opcional) => transferencia PARCIAL: solo esa porción se mueve a un lote
// nuevo en el destino (el origen conserva el resto). Omitida (o == cantidadDisponible)
// => se mueve el lote completo cambiando su `laboratorioId`, sin crear un lote nuevo,
// para no dejar lotes en 0.
//
// En ambos casos es un movimiento de UBICACIÓN: el stock físico agregado del item NO
// cambia (70 + 30 = 100), por eso el movimiento va con `cantidad: 0` y
// `cantidadAnterior == cantidadNueva` (ver invariante en movimientoStock.model.js). El
// monto trasladado y el origen/destino quedan como metadatos del movimiento; en el caso
// parcial, `loteId` apunta al lote destino nuevo.
const transferirLote = async (req, res) => {
  try {
    const { id } = req.params;
    const { laboratorioDestinoId = null, cantidad, observacion } = req.body;

    const lote = await Lote.findOne({ _id: id, activo: { $ne: false } });
    if (!lote) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }

    const origen = lote.laboratorioId ?? null;         // null = depósito
    const destino = laboratorioDestinoId ?? null;       // null = depósito

    if (String(origen) === String(destino)) {
      return res.status(400).json({
        error: "El lote ya se encuentra en la ubicación de destino"
      });
    }

    // Transferencia parcial: solo si se pidió una cantidad MENOR a la disponible.
    // `cantidad == cantidadDisponible` se trata como move completo (no crea lote en 0).
    let esParcial = false;
    if (cantidad !== undefined) {
      if (lote.estado !== "disponible") {
        return res.status(400).json({
          error: "Solo se puede transferir parcialmente un lote disponible"
        });
      }
      if (cantidad > lote.cantidadDisponible) {
        return res.status(400).json({
          error: "La cantidad a transferir supera la disponible del lote"
        });
      }
      esParcial = cantidad < lote.cantidadDisponible;
    }

    const loteResultado = esParcial
      ? await moverLoteParcial(lote, cantidad, destino)
      : await (async () => {
          lote.laboratorioId = destino;
          return lote.save();
        })();

    // DEVOLUCION si vuelve al depósito; TRANSFERENCIA en cualquier otro traslado.
    const tipoMovimiento = destino === null ? "DEVOLUCION" : "TRANSFERENCIA";
    // El agregado del item no cambia con un traslado de ubicación.
    const stockActual = await stockFisicoItem(lote.itemId);

    const observacionDefault = esParcial
      ? (tipoMovimiento === "DEVOLUCION"
          ? `Devolución parcial de ${cantidad} al depósito (desde lote ${lote._id})`
          : `Transferencia parcial de ${cantidad} a laboratorio (desde lote ${lote._id})`)
      : (tipoMovimiento === "DEVOLUCION"
          ? "Devolución de lote al depósito"
          : "Transferencia de lote a laboratorio");

    await registrarMovimientoLote({
      itemId: lote.itemId,
      tipoMovimiento,
      cantidad: 0,
      cantidadAnterior: stockActual,
      cantidadNueva: stockActual,
      loteId: loteResultado._id,
      origenLaboratorioId: origen,
      destinoLaboratorioId: destino,
      usuarioId: req.usuario?.id,
      observacion: observacion ?? observacionDefault
    });

    return res.status(200).json(loteResultado);
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
  transferirLote,
  deleteLote
};
