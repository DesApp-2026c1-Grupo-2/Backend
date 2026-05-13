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
const usuarioRouter = require('./routes/usuarioRoutes');
const itemRouter = require('./routes/itemRoutes');
const loteRouter = require('./routes/loteRoutes');
const recetaReactivoRouter = require('./routes/recetaReactivoRoutes');
const actividadRouter = require('./routes/actividadRoutes');


// Middlewares
app.use(cors());
app.use(express.json());


// Rutas
app.use('/items', itemRouter);
app.use('/edificio', edificioRouter);
app.use('/laboratorio', laboratorioRouter);
app.use('/equipo', equipoRouter);
app.use('/pedido', pedidoRouter);
app.use('/usuarios', usuarioRouter);
app.use('/lotes', loteRouter);
app.use('/receta-reactivos', recetaReactivoRouter);
app.use('/actividades', actividadRouter);





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

//test
const { seedPedidos } = require('./seed/pedido.seed.js');
const { seedUsuarios } = require('./seed/usuario.seed.js');
const { seedInventario } = require('./seed/inventario.seed.js');

seedPedidos();
seedUsuarios();
seedInventario();
