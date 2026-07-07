import mongoose from "mongoose";
import Descarte from "../models/descarte.model.js";
import Reserva from "../models/reserva.model.js";
import Pedido from "../models/pedido.model.js";
import Lote from "../models/lote.model.js";
import Equipo from "../models/equipo.model.js";
import Item from "../models/item.model.js";

export const registrarDescarteService = async (data, usuario) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { pedidoId, tipo, itemId, equipoId, cantidad, motivo } = data;

    // 1. Validaciones base
    const pedido = await Pedido.findById(pedidoId).session(session);
    if (!pedido) throw new Error("El pedido no existe.");

    // Validación de seguridad para Docentes
    if (usuario.rol === "DOCENTE" && pedido.docente.toString() !== usuario.id.toString()) {
      throw new Error("No tienes permiso para registrar un descarte en un pedido de otro docente.");
    }

    const reserva = await Reserva.findOne({ pedidoId }).session(session);
    if (!reserva) throw new Error("No existe una reserva asociada a este pedido.");

    let lotesAfectados = [];

    // 2. Lógica para EQUIPOS
    if (tipo === 'equipo') {
      const equipoEnReserva = reserva.equiposReservados.find(e => e.equipoId.toString() === equipoId);
      if (!equipoEnReserva) throw new Error("El equipo no forma parte de la reserva de este pedido.");

      const equipo = await Equipo.findById(equipoId).session(session);
      if (!equipo) throw new Error("El equipo no existe.");
      if (equipo.estado === 'fuera de servicio') throw new Error("El equipo ya se encuentra fuera de servicio.");

      equipo.estado = 'fuera de servicio';
      await equipo.save({ session });
    } 
    // 3. Lógica para MATERIALES / REACTIVOS
    else {
      const materialReserva = reserva.materialesReservados.find(m => m.itemId.toString() === itemId);
      if (!materialReserva) throw new Error("El ítem no forma parte de la reserva de este pedido.");

      const item = await Item.findById(itemId).session(session);
      if (!item) throw new Error("El ítem no existe.");

      // Validar histórico para no descartar más de lo usado
      const descartesPrevios = await Descarte.find({ pedidoId, itemId }).session(session);
      const totalDescartado = descartesPrevios.reduce((acc, curr) => acc + curr.cantidad, 0);

      if ((totalDescartado + cantidad) > materialReserva.cantidadTotal) {
        throw new Error(`La cantidad a descartar supera lo reservado (${materialReserva.cantidadTotal} total, ${totalDescartado} ya descartado).`);
      }

      // Mapear cuánto se ha descartado de cada lote en operaciones previas
      const descartadoPorLote = {};
      descartesPrevios.forEach(d => {
        if (d.lotesAfectados) {
          d.lotesAfectados.forEach(la => {
            const lId = la.loteId.toString();
            descartadoPorLote[lId] = (descartadoPorLote[lId] || 0) + la.cantidad;
          });
        }
      });

      let cantidadRestante = cantidad;

      // Lógica FIFO sobre los lotes usados en la reserva
      for (const loteUsado of materialReserva.lotesUsados) {
        if (cantidadRestante <= 0) break;

        const yaDescartado = descartadoPorLote[loteUsado.loteId.toString()] || 0;
        const disponibleParaDescartar = loteUsado.cantidad - yaDescartado;

        if (disponibleParaDescartar <= 0) continue;

        let descuento = 0;
        if (disponibleParaDescartar >= cantidadRestante) {
          descuento = cantidadRestante;
          cantidadRestante = 0;
        } else {
          descuento = disponibleParaDescartar;
          cantidadRestante -= disponibleParaDescartar;
        }

        if (descuento > 0) {
          lotesAfectados.push({
            loteId: loteUsado.loteId,
            cantidad: descuento
          });
        }
      }

      if (cantidadRestante > 0) {
        throw new Error("No hay suficiente cantidad disponible en los lotes asociados para cubrir el descarte.");
      }

      // Decremento físico SOLO para reutilizables (esConsumible === false). Los
      // consumibles ya descontaron su stock al ejecutarse el consumo (cronReservas
      // §7); descartarlos es puro registro. Los reutilizables nunca se
      // decrementaron (son puramente temporales), así que el descarte —romperse
      // durante el uso— es el evento que remueve su stock físico.
      // La guarda $gte evita dejar cantidadDisponible negativo (min:0 no se valida
      // en updateOne) y surfacea una inconsistencia física real.
      if (item.esConsumible === false) {
        for (const la of lotesAfectados) {
          const upd = await Lote.updateOne(
            { _id: la.loteId, cantidadDisponible: { $gte: la.cantidad } },
            { $inc: { cantidadDisponible: -la.cantidad } },
            { session }
          );
          if (upd.matchedCount === 0) {
            throw new Error("Stock físico insuficiente en el lote para registrar el descarte.");
          }
        }
      }
    }

    // 4. Generar el registro histórico de descarte
    const nuevoDescarte = new Descarte({
      pedidoId,
      reservaId: reserva._id,
      tipo,
      itemId: tipo !== 'equipo' ? itemId : undefined,
      equipoId: tipo === 'equipo' ? equipoId : undefined,
      cantidad,
      motivo,
      usuarioId: usuario.id,
      lotesAfectados
    });

    await nuevoDescarte.save({ session });

    // 5. Consagrar los cambios a la base de datos
    await session.commitTransaction();
    session.endSession();

    return nuevoDescarte;

  } catch (error) {
    // Rollback ante cualquier fallo
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const revertirDescarteService = async (descarteId, usuario) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const descarte = await Descarte.findById(descarteId).session(session);
    if (!descarte) throw new Error("El descarte no existe o ya fue eliminado.");

    const pedido = await Pedido.findById(descarte.pedidoId).session(session);
    if (!pedido) throw new Error("El pedido asociado no existe.");

    // Seguridad: Si es docente, solo puede revertir sus propios descartes
    if (usuario.rol === "DOCENTE" && pedido.docente.toString() !== usuario.id.toString()) {
      throw new Error("No tienes permiso para revertir un descarte en un pedido de otro docente.");
    }

    // Regla de inventario: Prevenir inconsistencias si el pedido ya cerró sus devoluciones físicas
    if (pedido.estado === "Finalizado" && descarte.tipo !== "equipo") {
      throw new Error("No se puede revertir un descarte de material o reactivo si el pedido ya fue finalizado.");
    }

    // Si es un equipo, lo regresamos al estado disponible
    if (descarte.tipo === "equipo") {
      const equipo = await Equipo.findById(descarte.equipoId).session(session);
      if (equipo && equipo.estado === "fuera de servicio") {
        equipo.estado = "disponible";
        await equipo.save({ session });
      }
    } else {
      // Material/reactivo: reponer el stock solo si el ítem es reutilizable, ya
      // que fue el único caso en que el descarte decrementó cantidadDisponible
      // (ver registrarDescarteService). Los consumibles no restaron nada.
      const item = await Item.findById(descarte.itemId).session(session);
      if (item && item.esConsumible === false && descarte.lotesAfectados) {
        for (const la of descarte.lotesAfectados) {
          await Lote.updateOne(
            { _id: la.loteId },
            { $inc: { cantidadDisponible: la.cantidad } },
            { session }
          );
        }
      }
    }

    await descarte.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};