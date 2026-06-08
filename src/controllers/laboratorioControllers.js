import Laboratorio from '../models/laboratorio.model.js';

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
        const laboratorios = await Laboratorio.find( { estado: { $ne: "eliminado" } } ); // Excluir laboratorios "fuera de servicio"
        res.status(200).json(laboratorios);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// R: Obtener un laboratorio por su ID
const obtenerLaboratorioPorId = async (req, res) => {
    try {
        const { idLaboratorio } = req.params;
        const laboratorio = await Laboratorio.findOne({ _id: idLaboratorio, estado: { $ne: "eliminado" } });
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

// R: Obtener todos los laboratorios de un edificio específico
const obtenerLaboratoriosPorEdificio = async (req, res) => {
    try {
        const { idEdificio } = req.params;

        const laboratorios = await Laboratorio
            .find({ edificioId: idEdificio , estado: { $ne: "eliminado" } })
            .populate("equiposFijos"); // va solo en este get???

        res.status(200).json(laboratorios);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// U: Modificar el estado de un laboratorio
const actualizarEstadoLaboratorio = async (req, res) => {
    try {
        const { idLaboratorio } = req.params;
        const { estado } = req.body;

        // Validación rápida del estado contra el enum definido
        const estadosValidos = ["disponible", "en mantenimiento", "fuera de servicio"];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ message: "Estado no válido. Los estados permitidos son: " + estadosValidos.join(', ') });
        }

        const laboratorioActualizado = await Laboratorio.findByIdAndUpdate(
            idLaboratorio,
            { estado },
            { new: true, runValidators: true }
        );

        if (!laboratorioActualizado) {
            return res.status(404).json({ message: "Laboratorio no encontrado" });
        }

        res.status(200).json(laboratorioActualizado);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
const actualizarLaboratorio = async (req, res) => {
    try {
        const { idLaboratorio } = req.params;
        const { nombre, edificioId, capacidad, tipo, estado } = req.body;
        const laboratorioActualizado = await Laboratorio.findByIdAndUpdate(
            idLaboratorio,
            { nombre, edificioId, capacidad, tipo, estado },
            { new: true, runValidators: true }
        );
        if (!laboratorioActualizado) {
            return res.status(404).json({ message: "Laboratorio no encontrado" });
        }
        res.status(200).json(laboratorioActualizado);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
const eliminarLaboratorioLogico = async (req, res) => {
    try {
        const { idLaboratorio } = req.params;
        const laboratorioEliminado = await Laboratorio.findByIdAndUpdate(
            idLaboratorio,
            { estado: "eliminado" },
            { new: true }
        );
        if (!laboratorioEliminado) {
            return res.status(404).json({ message: "Laboratorio no encontrado" });
        }
        res.status(200).json(laboratorioEliminado);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
export {
    crearLaboratorio,
    obtenerLaboratorios,
    obtenerLaboratorioPorId,
    obtenerLaboratoriosDisponibles,
    obtenerLaboratoriosPorEdificio,
    actualizarEstadoLaboratorio,
    actualizarLaboratorio,
    eliminarLaboratorioLogico
};