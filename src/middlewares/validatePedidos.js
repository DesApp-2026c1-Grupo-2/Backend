const Pedido = require("../models/pedido.model");

const laboratorios = [
  { nombre: "Laboratorio A1", capacidad: 30 },
  { nombre: "Laboratorio A2", capacidad: 25 },
  { nombre: "Laboratorio B1", capacidad: 40 },
];

const equiposDisponibles = {
  "Centrífuga": 3,
  "Microscopio": 10,
  "Incubadora": 2,
};

const materialesStock = {
  "Tubos de ensayo": 50,
  "Pipetas": 100,
};

const reactivosStock = {
  "Ácido nítrico": 20,
  "Colorante": 30,
};

const validarPedido = async (req, res, next) => {
  try {
    const data = req.body;
    const problemas = [];

    const existe = await Pedido.findOne({
      laboratorio: data.laboratorio,
      fecha: data.fecha,
      hora: data.hora,
      estado: { $ne: "Rechazado" },
    });

    if (existe) {
      problemas.push("El laboratorio ya está ocupado en ese horario");
    }

    const lab = laboratorios.find((l) => l.nombre === data.laboratorio);

    if (lab && data.alumnos > lab.capacidad) {
      problemas.push("El laboratorio no tiene capacidad suficiente");
    }


    data.recursos?.forEach((r) => {
      if (r.tipo === "Equipo") {
        if (!equiposDisponibles[r.nombre] || equiposDisponibles[r.nombre] < r.cantidad) {
          problemas.push(`No hay suficientes equipos: ${r.nombre}`);
        }
      }

      if (r.tipo === "Material") {
        if (!materialesStock[r.nombre] || materialesStock[r.nombre] < r.cantidad) {
          problemas.push(`Stock insuficiente de material: ${r.nombre}`);
        }
      }

      if (r.tipo === "Reactivo") {
        if (!reactivosStock[r.nombre] || reactivosStock[r.nombre] < r.cantidad) {
          problemas.push(`Stock insuficiente de reactivo: ${r.nombre}`);
        }
      }
    });

    req.problemas = problemas;
    req.estadoCalculado =
      problemas.length > 0 ? "En Revisión" : "Pendiente";

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = validarPedido;