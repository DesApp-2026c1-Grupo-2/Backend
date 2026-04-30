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

// Middlewares
app.use(cors());
app.use(express.json());


// Rutas
app.use('/edificio', edificioRouter);
app.use('/laboratorio', laboratorioRouter);
app.use('/equipo', equipoRouter);
app.use('/pedido', pedidoRouter);
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI


mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("Conectado a MongoDB correctamente");
  })
  .catch((err) => {
    console.error(" Error conectando a MongoDB:", err);
  });

app.listen(PORT, () => {
    console.log('Servidor corriendo en el puerto ' + PORT)
})