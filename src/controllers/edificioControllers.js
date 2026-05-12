const Edificio = require('../models/edificio.model');


// C: Crear un nuevo edificio
const crearEdificio = async (req, res) => {
  try {
    const { nombre, direccion } = req.body;

    const edificio = new Edificio({
      nombre,
      direccion,
    });

    await edificio.save();

    res.status(201).json(edificio);

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


// R: Obtener todos los edificios
const obtenerEdificios = async (req, res) => {
  try {

    const edificios = await Edificio.find()
      .populate("cantidadLaboratorios");

    res.status(200).json(edificios);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  crearEdificio,
  obtenerEdificios
};