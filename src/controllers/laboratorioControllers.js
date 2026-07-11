import Laboratorio from '../models/laboratorio.model.js';
import Pedido from '../models/pedido.model.js';

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
        const laboratorios = await Laboratorio.find( { estado: { $ne: "eliminado" } } );
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
            .populate("equiposFijos");

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

// R: Obtener laboratorios disponibles para un horario (inicio y fin)
const obtenerLaboratoriosDisponiblesPorHorario = async (req, res) => {
    try {
        const { fechaHora, fechaFin, duracionClase, alumnos } = req.query;

        if (!fechaHora) {
            return res.status(400).json({ message: "Debe indicar fechaHora" });
        }

        const inicioSolicitado = new Date(fechaHora);
        if (isNaN(inicioSolicitado.getTime())) {
            return res.status(400).json({ message: "fechaHora inválida" });
        }

        let finSolicitado;
        if (fechaFin) {
            finSolicitado = new Date(fechaFin);
            if (isNaN(finSolicitado.getTime())) {
                return res.status(400).json({ message: "fechaFin inválida" });
            }
        } else {
            const duracion = duracionClase ? Number(duracionClase) : 120;
            finSolicitado = new Date(inicioSolicitado.getTime() + (duracion + 30) * 60 * 1000);
        }

        const inicioVentana = new Date(inicioSolicitado.getTime() - 60 * 60 * 1000);

        const pedidos = await Pedido.find({
            fechaInicioReal: { $lt: finSolicitado },
            fechaFinReal: { $gt: inicioVentana },
            estado: { $in: ["Pendiente", "Aceptado"] }, // CAMBIO: Se eliminó "En Revisión"
            activo: { $ne: false },
        }).select("laboratorio");

        const laboratoriosOcupados = pedidos
            .map(p => p.laboratorio)
            .filter(Boolean);

        const filtro = {
            estado: "disponible",
            _id: { $nin: laboratoriosOcupados },
        };

        if (alumnos) {
            filtro.capacidad = { $gte: Number(alumnos) };
        }

        const laboratorios = await Laboratorio.find(filtro);

        res.json(laboratorios);
    } catch (error) {
        res.status(500).json({ message: error.message });
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
    eliminarLaboratorioLogico,
    obtenerLaboratoriosDisponiblesPorHorario
};