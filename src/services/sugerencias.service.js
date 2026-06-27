import Actividad from "../models/actividad.model.js";
import SugerenciaRecurso from "../models/sugerenciaRecurso.model.js";
import Lote from "../models/lote.model.js";
import Item from "../models/item.model.js";
import Equipo from "../models/equipo.model.js";

export const getSugerenciasPorActividad = async (actividadId) => {
  // 1. Validación inicial
  const actividad = await Actividad.findById(actividadId);
  if (!actividad) {
    throw new Error("Actividad no encontrada");
  }

  // 2. Obtener sugerencias
  const sugerencias = await SugerenciaRecurso.find({
    tipoActividad: actividad.tipo,
    activo: true
  }).sort({ orden: 1, createdAt: 1 });

  // 3. Separación eficiente (UNA sola pasada)
  const itemsSugeridos = [];
  const equiposSugeridos = [];

  for (const s of sugerencias) {
    if (s.itemId) itemsSugeridos.push(s);
    else if (s.equipoId) equiposSugeridos.push(s);
  }

  // 4. Obtener recursos en paralelo
  const itemIds = itemsSugeridos.map(s => s.itemId);
  const equipoIds = equiposSugeridos.map(s => s.equipoId);
  
  const [itemsFromDb, equiposFromDb] = await Promise.all([
    itemIds.length > 0 ? Item.find({ _id: { $in: itemIds }, activo: { $ne: false } }) : [],
    equipoIds.length > 0 ? Equipo.find({ _id: { $in: equipoIds }, activo: { $ne: false } }) : []
  ]);

  // 5. Crear mapas O(1)
  const itemsMap = new Map(itemsFromDb.map(i => [i._id.toString(), i]));
  const equiposMap = new Map(equiposFromDb.map(e => [e._id.toString(), e]));

  // 6. Calcular stock optimizado (UNA aggregation)
  let stockMap = {};

  if (itemIds.length > 0) {
    const stockPorItem = await Lote.aggregate([
      {
        $match: {
          itemId: { $in: itemIds },
          estado: 'disponible',
          activo: { $ne: false }
        }
      },
      {
        $group: {
          _id: '$itemId',
          stockTotal: { $sum: '$cantidadDisponible' }
        }
      }
    ]);
    stockMap = Object.fromEntries(
      stockPorItem.map(s => [s._id.toString(), s.stockTotal])
    );
  }

  // 7. Enriquecer items (con validación defensiva)
  const items = itemsSugeridos.map(s => {
    const item = itemsMap.get(s.itemId.toString());

    if (!item) {
      console.warn(`[Sugerencias] Item ${s.itemId} no encontrado para sugerencia ${s._id}`);
      return null;
    }

    const stockDisponible = stockMap[s.itemId.toString()] || 0;

    return {
      item,
      cantidadSugerida: s.cantidadSugerida,
      stockDisponible,
      disponible: stockDisponible >= s.cantidadSugerida
    };
  }).filter(Boolean);

  // 8. Enriquecer equipos (con validación defensiva)
  const equipos = equiposSugeridos.map(s => {
    const equipo = equiposMap.get(s.equipoId.toString());

    if (!equipo) {
      console.warn(`[Sugerencias] Equipo ${s.equipoId} no encontrado para sugerencia ${s._id}`);
      return null;
    }

    return {
      equipo,
      cantidadSugerida: s.cantidadSugerida,
      disponible: equipo.estado === 'disponible' && equipo.activo !== false
    };
  }).filter(Boolean);

  // 9. Return final
  return { items, equipos };
};