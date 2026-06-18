import mongoose from "mongoose";
import SugerenciaRecurso from "../models/sugerenciaRecurso.model.js";
import Item from "../models/item.model.js";
import Equipo from "../models/equipo.model.js";

export const seedSugerenciasRecurso = async () => {
  try {
    await SugerenciaRecurso.deleteMany({});

    const items = await Item.find();
    const equipos = await Equipo.find();

    if (items.length === 0 && equipos.length === 0) {
      console.log("⚠️ No se encontraron Ítems ni Equipos para generar Sugerencias. Ejecuta primero inventario y equipos.");
      return;
    }

    const tubo = items.find(i => i.codigo === 'MAT-001');
    const vaso = items.find(i => i.codigo === 'MAT-002');
    const microscopio = equipos.length > 0 ? equipos[0] : null; 
    const acido = items.find(i => i.codigo === 'REA-002');

    const sugerenciasPrueba = [];

    if (tubo) {
      sugerenciasPrueba.push({ tipoActividad: 'biologia', itemId: tubo._id, cantidadSugerida: 15, orden: 1 });
      sugerenciasPrueba.push({ tipoActividad: 'quimica', itemId: tubo._id, cantidadSugerida: 20, orden: 2 });
    }
    
    if (vaso) {
      sugerenciasPrueba.push({ tipoActividad: 'quimica', itemId: vaso._id, cantidadSugerida: 5, orden: 1 });
    }

    if (microscopio) {
      sugerenciasPrueba.push({ tipoActividad: 'biologia', equipoId: microscopio._id, cantidadSugerida: 1, orden: 2 });
    }
    
    if (acido) {
      sugerenciasPrueba.push({ tipoActividad: 'quimica', itemId: acido._id, cantidadSugerida: 100, orden: 3 });
    }

    if (sugerenciasPrueba.length > 0) {
      await SugerenciaRecurso.insertMany(sugerenciasPrueba);
      console.log(`✅ Se insertaron exitosamente ${sugerenciasPrueba.length} sugerencias de recursos.`);
    }
  } catch (error) {
    console.error("❌ Error al sembrar las sugerencias de recursos:", error);
  }
};