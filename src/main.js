import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';

const app = express();

// --- Importación de Rutas ---
import edificioRouter from './routes/edificioRoutes.js';
import laboratorioRouter from './routes/laboratorioRoutes.js';
import equipoRouter from './routes/equipoRoutes.js';
import pedidoRouter from './routes/pedidoRoutes.js';
import usuarioRouter from './routes/usuarioRoutes.js';
import itemRouter from './routes/itemRoutes.js';
import loteRouter from './routes/loteRoutes.js';
import recetaReactivoRouter from './routes/recetaReactivoRoutes.js';
import actividadRouter from './routes/actividadRoutes.js';
import produccionReactivoRouter from './routes/produccionReactivoRoutes.js';
import reservaRoutes from './routes/reservaRoutes.js';
import descarteRoutes from './routes/descarte.routes.js';
import sugerenciaRecursoRouter from './routes/sugerenciaRecurso.routes.js';

import { iniciarCronReservas } from './services/cronReservas.js';



// Middlewares
app.use(cors());
app.use(express.json());


// Rutas
app.use('/edificio', edificioRouter);
app.use('/laboratorio', laboratorioRouter);
app.use('/equipo', equipoRouter);
app.use('/pedido', pedidoRouter);
app.use('/usuarios', usuarioRouter);
app.use('/items', itemRouter);
app.use('/lotes', loteRouter);
app.use('/receta-reactivos', recetaReactivoRouter);
app.use('/actividades', actividadRouter);
app.use('/produccion-reactivos', produccionReactivoRouter);
app.use('/reservas', reservaRoutes);
app.use('/descartes', descarteRoutes);
app.use('/sugerencias', sugerenciaRecursoRouter);

app.get('/__backend-test__', (req, res) => res.json({ok: true}));
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI


mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("Conectado a MongoDB correctamente");
    // Cron de ciclo de vida de reservas (§6/§7/§9): Pendiente→En Curso con
    // consumo físico de consumibles y En Curso→Finalizada.
    iniciarCronReservas();
  })
  .catch((err) => {
    console.error(" Error conectando a MongoDB:", err);
  });

app.listen(PORT, () => {
    console.log('Servidor corriendo en el puerto ' + PORT)
})
