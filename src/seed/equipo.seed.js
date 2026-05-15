const mongoose = require("mongoose");
const Equipo = require("../models/equipo.model");
const Edificio = require("../models/edificio.model");
const Laboratorio = require("../models/laboratorio.model");

const seedEquipos = async () => {
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
        estado: "en mantenimiento",
        edificioId: edificio._id,
        laboratorioId: laboratorio ? laboratorio._id : undefined
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

module.exports = { seedEquipos };