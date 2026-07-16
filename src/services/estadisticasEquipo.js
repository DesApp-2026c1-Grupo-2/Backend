import mongoose from "mongoose";
import Reserva from "../models/reserva.model.js";

/*
 * Estadísticas de uso de equipos para planificación de mantenimiento.
 *
 * Un "uso" = una reserva Finalizada (la ventana de la reserva ya se completó,
 * por lo tanto el equipo fue efectivamente utilizado). Se descartan Pendiente,
 * En Curso, Cancelada y Conflicto porque no representan desgaste consumado.
 *
 * Las reservas nunca se borran físicamente (cancelarReserva solo cambia estado
 * a 'Cancelada'), así que el histórico es confiable para contar usos.
 */

const PERIODOS = ["dia", "semana", "mes"];

/*
 * Deriva el rango [desde, hasta) del período que contiene `fecha`.
 * Semana: lunes 00:00 a lunes siguiente (ISO-8601).
 * Trabaja en la zona horaria local del servidor.
 */
export const calcularRango = (periodo, fecha = new Date()) => {
  const base = new Date(fecha);
  if (Number.isNaN(base.getTime())) {
    throw new Error("Fecha de referencia inválida");
  }

  let desde;
  let hasta;

  if (periodo === "dia") {
    desde = new Date(base);
    desde.setHours(0, 0, 0, 0);
    hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 1);
  } else if (periodo === "semana") {
    desde = new Date(base);
    desde.setHours(0, 0, 0, 0);
    const dia = desde.getDay(); // 0=domingo .. 6=sábado
    const diffALunes = dia === 0 ? -6 : 1 - dia;
    desde.setDate(desde.getDate() + diffALunes);
    hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 7);
  } else if (periodo === "mes") {
    desde = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0);
    hasta = new Date(base.getFullYear(), base.getMonth() + 1, 1, 0, 0, 0, 0);
  } else {
    throw new Error(`Período inválido: ${periodo}. Válidos: ${PERIODOS.join(", ")}`);
  }

  return { desde, hasta };
};

/*
 * Ranking paginado de equipos por cantidad de usos (reservas Finalizadas)
 * dentro del rango temporal. Ordena de mayor a menor uso (los primeros son los
 * candidatos a mantenimiento). Devuelve datos + metadatos de paginación en una
 * sola consulta vía $facet.
 *
 * @param {Object} params
 * @param {'dia'|'semana'|'mes'} params.periodo
 * @param {Date}   params.fecha          fecha de referencia
 * @param {string} [params.laboratorioId] filtra por lab donde ocurrió la reserva
 * @param {string} [params.equipoId]      restringe a un solo equipo
 * @param {number} params.page           1-indexed
 * @param {number} params.limit          tamaño de página
 */
export const obtenerEstadisticasUso = async ({
  periodo,
  fecha,
  laboratorioId,
  equipoId,
  page,
  limit,
}) => {
  const { desde, hasta } = calcularRango(periodo, fecha);

  const matchReserva = {
    estado: "Finalizada",
    fechaHora: { $gte: desde, $lt: hasta },
  };
  if (laboratorioId) {
    matchReserva.laboratorioId = new mongoose.Types.ObjectId(laboratorioId);
  }

  const pipeline = [{ $match: matchReserva }, { $unwind: "$equiposReservados" }];

  if (equipoId) {
    pipeline.push({
      $match: {
        "equiposReservados.equipoId": new mongoose.Types.ObjectId(equipoId),
      },
    });
  }

  pipeline.push(
    { $group: { _id: "$equiposReservados.equipoId", usos: { $sum: 1 } } },
    // _id como desempate para que la paginación sea estable ante empates de usos.
    { $sort: { usos: -1, _id: 1 } },
    {
      $facet: {
        datos: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          // El $lookup va DESPUÉS del skip/limit: solo poblamos la página visible.
          {
            $lookup: {
              from: "equipos",
              localField: "_id",
              foreignField: "_id",
              as: "equipo",
            },
          },
          { $unwind: "$equipo" },
          {
            $project: {
              _id: 0,
              equipoId: "$_id",
              usos: 1,
              nombre: "$equipo.nombre",
              codigo: "$equipo.codigo",
              tipo: "$equipo.tipo",
              estado: "$equipo.estado",
            },
          },
        ],
        meta: [{ $count: "total" }],
      },
    }
  );

  const [resultado] = await Reserva.aggregate(pipeline);
  const total = resultado?.meta?.[0]?.total ?? 0;
  const equipos = resultado?.datos ?? [];

  return {
    periodo,
    desde,
    hasta,
    paginacion: {
      page,
      limit,
      total,
      totalPaginas: Math.ceil(total / limit),
    },
    equipos,
  };
};
