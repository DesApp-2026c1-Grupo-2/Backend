const Laboratorio = require("../models/laboratorio.model");
const Edificio = require("../models/edificio.model");

const laboratoriosPorDefecto = [
  {
    nombre: "Lab 1 — General",
    capacidad: 40,
    tipo: "mixto",
    estado: "disponible",
  },
  {
    nombre: "Lab 2 — Química",
    capacidad: 30,
    tipo: "quimica",
    estado: "disponible",
  },
  {
    nombre: "Lab 3 — Física",
    capacidad: 32,
    tipo: "biologia",
    estado: "disponible",
  },
  {
    nombre: "Lab 5 — Bioquímica",
    capacidad: 35,
    tipo: "mixto",
    estado: "disponible",
  },
];

const seedLaboratorios = async () => {
  try {
    const edificioNombre = "Edificio Central";
    let edificio = await Edificio.findOne({ nombre: edificioNombre });

    if (!edificio) {
      edificio = await Edificio.create({
        nombre: edificioNombre,
        direccion: "Av. Principal 123",
      });
    }

    for (const labData of laboratoriosPorDefecto) {
      const existe = await Laboratorio.findOne({ nombre: labData.nombre });
      if (!existe) {
        await Laboratorio.create({
          ...labData,
          edificioId: edificio._id,
        });
      }
    }
  } catch (error) {
    console.error("Error al sembrar laboratorios:", error);
  }
};

module.exports = {
  seedLaboratorios,
};
