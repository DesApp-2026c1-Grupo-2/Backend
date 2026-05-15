//necesito hacer un test de la ruta de pedidos, para eso necesito crear un pedido de prueba, para eso necesito un laboratorio de prueba, para eso necesito un edificio de prueba, para eso necesito una materia de prueba, para eso necesito un docente de prueba, para eso necesito un alumno de prueba, para eso necesito crear un usuario de prueba, para eso necesito crear un rol de prueba
const mongoose = require("mongoose");
const Pedido = require("../models/pedido.model");

const pedidosPrueba =[ {
  materia: "Matemáticas",
  docente: "Juan Pérez",
  fecha: "2024-06-01",
  hora: "10:00",
  laboratorio: "Lab 1 — General",
  alumnos: 20,
  recursos: [
    { tipo: "Equipo", nombre: "Micropipetas P200", cantidad: 2 },
    { tipo: "Material", nombre: "Tubos eppendorf", cantidad: 10 },
    { tipo: "Reactivo", nombre: "Buffer de lisis", cantidad: 5 },
  ],
},
{
  materia: "Inglés",
  docente: "Jose Pérez",
  fecha: "2024-06-01",
  hora: "12:00",
  laboratorio: "Lab 2 — Química",
  alumnos: 20,
  estado: "Aceptado",
  recursos: [
    { tipo: "Equipo", nombre: "Espectrofotómetro UV", cantidad: 1 },
    { tipo: "Material", nombre: "Tubos eppendorf", cantidad: 10 },
    { tipo: "Reactivo", nombre: "Buffer de lisis", cantidad: 5 },
  ],
},
{
  materia: "Geografía",
  docente: "Jose Paz",
  fecha: "2024-06-02",
  hora: "13:00",
  laboratorio: "Lab 3 — Física",
  alumnos: 22,
  estado: "Rechazado",
  recursos: [
    { tipo: "Equipo", nombre: "Centrífuga de mesa", cantidad: 1 },
    { tipo: "Material", nombre: "Tubos eppendorf", cantidad: 1 },
    { tipo: "Reactivo", nombre: "Buffer de lisis", cantidad: 8 },
  ],
}
];

exports.seedPedidos = async () => {
  try {
    await Pedido.deleteMany({});
    await Pedido.insertMany(pedidosPrueba);
  } catch (error) {
    console.error("Error al sembrar los pedidos:", error);
  }
};