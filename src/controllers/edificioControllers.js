import Edificio from '../models/edificio.model.js';


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

    // Devolver solo edificios activos (estado === true)
    const edificios = await Edificio.find({ estado: true })
      .populate("cantidadLaboratorios");

    res.status(200).json(edificios);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const obtenerEdificioPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const edificio = await Edificio.findById(id)
      .populate("cantidadLaboratorios");

    if (!edificio) {
      return res.status(404).json({ message: "Edificio no encontrado" });
    }
    res.status(200).json(edificio);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const actualizarEdificio = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, direccion } = req.body;
    const edificio = await Edificio.findByIdAndUpdate(id, { nombre, direccion }, { new: true });
    if (!edificio) {
      return res.status(404).json({ message: "Edificio no encontrado" });
    }
    res.status(200).json(edificio);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const eliminarEdificioLogico = async (req, res) => {
  try {
    const { id } = req.params;
    const edificio = await Edificio.findByIdAndUpdate(id, { estado: false }, { new: true });
    if (!edificio) {
      return res.status(404).json({ message: "Edificio no encontrado" });
    }
    res.status(200).json(edificio);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export {
  crearEdificio,
  obtenerEdificios,
  obtenerEdificioPorId,
  actualizarEdificio,
  eliminarEdificioLogico
};