import mongoose from "mongoose";
import Actividad from "../models/actividad.model.js";

export const seedActividades = async () => {
  try {
    await Actividad.deleteMany({});
    
    const actividadesPrueba = [
      { nombre: 'Práctica de Biología Celular', fecha: new Date('2026-06-15T10:00:00Z'), tipo: 'biologia', estado: 'planificada' },
      { nombre: 'Preparación de Soluciones', fecha: new Date('2026-05-10T14:00:00Z'), tipo: 'quimica', estado: 'finalizada' },
      { nombre: 'Clase Teórica de Normas de Seguridad', fecha: new Date('2026-07-01T09:00:00Z'), tipo: 'teorica', estado: 'planificada' }
    ];

    await Actividad.insertMany(actividadesPrueba);
    console.log(`✅ Se insertaron exitosamente ${actividadesPrueba.length} actividades de prueba.`);
  } catch (error) {
    console.error("❌ Error al sembrar las actividades:", error);
  }
};