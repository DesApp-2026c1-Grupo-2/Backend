const express = require('express');
const mongoose = require('mongoose');
const app = express();
const cors = require('cors');
require('dotenv').config();

// --- Importación de Rutas ---
const edificioRouter = require('./routes/edificioRoutes');
const laboratorioRouter = require('./routes/laboratoriotRoutes');
const equipoRouter = require('./routes/equipoRoutes');
const pedidoRouter = require('./routes/pedidoRoutes');
const { obtenerLaboratoriosDisponibles } = require('./controllers/laboratorioControllers');

// Middlewares
app.use(cors());
app.use(express.json());


// Rutas
app.use('/edificio', edificioRouter);
app.use('/laboratorio', laboratorioRouter);
app.use('/equipo', equipoRouter);
app.use('/pedido', pedidoRouter);
app.get('/laboratorios/disponibles', obtenerLaboratoriosDisponibles);
app.get('/laboratorios/disponibles-check', obtenerLaboratoriosDisponibles);
app.get('/__backend-test__', (req, res) => res.json({ok: true}));
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI


const { seedLaboratorios } = require('./seed/laboratorio.seed.js');

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("Conectado a MongoDB correctamente");
    await seedLaboratorios();
  })
  .catch((err) => {
    console.error(" Error conectando a MongoDB:", err);
  });

app.listen(PORT, () => {
  console.log('Servidor corriendo en el puerto ' + PORT);
});
