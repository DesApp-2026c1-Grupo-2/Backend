const express = require('express');
const mongoose = require('mongoose');
const app = express();
require('dotenv').config();

const equipoRouter = require('./routes/equipoRoutes');

app.use(express.json());
app.use('/equipo', equipoRouter);



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