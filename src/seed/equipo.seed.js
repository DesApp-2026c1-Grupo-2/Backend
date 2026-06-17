import mongoose from "mongoose";
import Equipo from "../models/equipo.model.js";
import Edificio from "../models/edificio.model.js";
import Laboratorio from "../models/laboratorio.model.js";

export const seedEquipos = async () => {
  try {
    await Equipo.deleteMany({});

    // Necesitamos referenciar un edificio y un laboratorio existentes
    const edificio = await Edificio.findOne();
    const laboratorio = await Laboratorio.findOne();

    if (!edificio) {
      console.log("⚠️ No se pudieron sembrar los equipos: No hay edificios registrados. Ejecuta primero los seeds de laboratorios.");
      return;
    }

    const equiposPrueba = [
      {
        nombre: "Microscopio Óptico Binocular",
        codigo: "EQ-MIC-001",
        tipo: "Microscopio",
        esFijo: true,
        estado: "disponible",
        edificioId: edificio._id,
        laboratorioId: laboratorio ? laboratorio._id : undefined
      },
      {
        nombre: "Balanza Analítica de Precisión",
        codigo: "EQ-BAL-001",
        tipo: "Balanza",
        esFijo: false, // Equipo móvil, no lleva laboratorioId
        estado: "disponible",
        edificioId: edificio._id
      },
      {
        nombre: "Espectrofotómetro UV-Vis",
        codigo: "EQ-ESP-001",
        tipo: "Espectrofotómetro",
        esFijo: true,
        estado: "mantenimiento",
        edificioId: edificio._id,
        laboratorioId: laboratorio ? laboratorio._id : undefined
      },
      {
        nombre: "Centrífuga Refrigerada",
        codigo: "EQ-CEN-001",
        tipo: "Centrífuga",
        esFijo: true,
        estado: "disponible",
        edificioId: edificio._id,
        laboratorioId: laboratorio ? laboratorio._id : undefined
      },
      {
        nombre: "Agitador Magnético",
        codigo: "EQ-AGI-001",
        tipo: "Agitador",
        esFijo: false,
        estado: "fuera de servicio",
        edificioId: edificio._id
      },
      {
        nombre: "Microscopio Óptico Trinocular",
        codigo: "EQ-MIC-002",
        tipo: "Microscopio",
        esFijo: false,
        estado: "disponible",
        edificioId: edificio._id
      }
    ];

    // Filtramos para evitar que intente insertar un equipo fijo si por alguna razón no hay laboratorios
    const equiposValidos = equiposPrueba.filter(eq => !(eq.esFijo && !eq.laboratorioId));

    await Equipo.insertMany(equiposValidos);
    console.log("✅ Equipos sembrados correctamente.");
  } catch (error) {
    console.error("❌ Error al sembrar los equipos:", error);
  }
};