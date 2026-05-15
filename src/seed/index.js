const mongoose = require("mongoose");
require("dotenv").config();
const { seedLaboratorios } = require("./laboratorio.seed.js");
const { seedPedidos } = require("./pedido.seed.js");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/gestionLaboratorios";

const runSeeds = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    await seedLaboratorios();
    await seedPedidos();
    console.log("Seed completado correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("Error ejecutando seeds:", error);
    process.exit(1);
  }
};

runSeeds();
