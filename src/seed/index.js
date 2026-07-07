import mongoose from "mongoose";
import "dotenv/config";
import { seedUsuarios } from "./usuario.seed.js";
import { seedLaboratorios } from "./laboratorio.seed.js";
import { seedActividades } from "./actividad.seed.js";
import { seedInventario } from "./inventario.seed.js";
import { seedPedidos } from "./pedido.seed.js";
import { seedEquipos } from "./equipo.seed.js";
import { seedHistorialMantenimiento } from "./historialMantenimiento.seed.js";
import { seedSugerenciasRecurso } from "./sugerenciaRecurso.seed.js";
import { seedReservas } from "./reserva.seed.js";
import { seedDescartes } from "./descarte.seed.js";
import { seedMovimientosStock } from "./movimientoStock.seed.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/gestionLaboratorios";

const runSeeds = async () => {
  try {
    console.log("Conectando a la base de datos...");
    await mongoose.connect(MONGO_URI);
    
    console.log("Iniciando la siembra de datos...");
    // El orden es importante para mantener la integridad referencial
    await seedUsuarios();
    await seedLaboratorios();
    await seedActividades();
    await seedInventario();
    await seedEquipos();
    await seedHistorialMantenimiento();
    await seedSugerenciasRecurso();
    await seedPedidos();
    await seedReservas();
    await seedDescartes();
    // El historial de movimientos se reconstruye sobre el estado físico ya sembrado.
    await seedMovimientosStock();

    console.log("✅ Seed general completado correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error ejecutando seeds:", error);
    process.exit(1);
  }
};

runSeeds();
