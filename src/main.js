const express = require('express');
const mongoose = require('mongoose');
const app = express();
require('dotenv').config();
const YAML = require('yamljs');

const laboratorioRouter = require('./routes/laboratoriotRoutes');


app.use(express.json())
//routes
app.use('/laboratorio', laboratorioRouter);

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