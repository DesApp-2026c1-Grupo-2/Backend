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