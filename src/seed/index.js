const mongoose = require("mongoose");
require("dotenv").config();
const { seedUsuarios } = require("./usuario.seed.js");
const { seedLaboratorios } = require("./laboratorio.seed.js");
const { seedInventario } = require("./inventario.seed.js");
const { seedPedidos } = require("./pedido.seed.js");
const { seedEquipos } = require("./equipo.seed.js");
const { seedReservas } = require("./reserva.seed.js");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/gestionLaboratorios";

const runSeeds = async () => {
  try {
    console.log("Conectando a la base de datos...");
    await mongoose.connect(MONGO_URI);
    
    console.log("Iniciando la siembra de datos...");
    // El orden es importante para mantener la integridad referencial
    await seedUsuarios();
    await seedLaboratorios();
    await seedInventario();
    await seedEquipos();
    await seedPedidos();
    await seedReservas();
    
    console.log("✅ Seed general completado correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error ejecutando seeds:", error);
    process.exit(1);
  }
};

runSeeds();
