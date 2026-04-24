const  Laboratorio  = require('../models/laboratorio.model');

// C: Crear un nuevo laboratorio
const crearLaboratorio = async (req, res) => {
    try {
        const { nombre, edificioId, capacidad, tipo, estado } = req.body;
        const nuevoLaboratorio = new Laboratorio({
            nombre,
            edificioId,
            capacidad,
            tipo,
            estado
        });
        const laboratorioGuardado = await nuevoLaboratorio.save();
        res.status(201).json(laboratorioGuardado);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// R: Obtener todos los laboratorios
const obtenerLaboratorios = async (req, res) => {
    try {
        const laboratorios = await Laboratorio.find();
        res.status(200).json(laboratorios);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// R: Obtener un laboratorio por su ID
const obtenerLaboratorioPorId = async (req, res) => {
    try {
        const { idLaboratorio } = req.params;
        const laboratorio = await Laboratorio.findById(idLaboratorio);
        if (!laboratorio) {
            return res.status(404).json({ message: "Laboratorio no encontrado" });
        }
        res.status(200).json(laboratorio);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// R: Obtener todos los laboratorios disponibles
const obtenerLaboratoriosDisponibles = async (req, res) => {
    try {
        const laboratorios = await Laboratorio.find({ estado: "disponible" });
        res.status(200).json(laboratorios);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    crearLaboratorio,
    obtenerLaboratorios,
    obtenerLaboratorioPorId,
    obtenerLaboratoriosDisponibles
};