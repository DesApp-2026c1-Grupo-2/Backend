//necesito hacer un test de la ruta de pedidos, para eso necesito crear un pedido de prueba, para eso necesito un laboratorio de prueba, para eso necesito un edificio de prueba, para eso necesito una materia de prueba, para eso necesito un docente de prueba, para eso necesito un alumno de prueba, para eso necesito crear un usuario de prueba, para eso necesito crear un rol de prueba
const mongoose = require("mongoose");
const Pedido = require("../models/pedido.model");

const pedidosPrueba =[ {
  materia: "Matemáticas",
  docente: "Juan Pérez",
    fecha: "2024-06-01",
    hora: "10:00",
    laboratorio: "Laboratorio A1",
    alumnos: 20,
    recursos: [
        { tipo: "Equipo", nombre: "Microscopio", cantidad: 2 },
        { tipo: "Material", nombre: "Tubos de ensayo", cantidad: 10 },
        { tipo: "Reactivo", nombre: "Ácido nítrico", cantidad: 5 },
    ],
},
{
  materia: "Ingles",
  docente: "Jose Pérez",
    fecha: "2024-06-01",
    hora: "12:00",
    laboratorio: "Laboratorio A2",
    alumnos: 20,
    estado: "Aceptado",
    recursos: [
        { tipo: "Equipo", nombre: "Microscopio", cantidad: 2 },
        { tipo: "Material", nombre: "Tubos de ensayo", cantidad: 10 },
        { tipo: "Reactivo", nombre: "Ácido nítrico", cantidad: 5 },
    ],
},{
  materia: "Geografía",
  docente: "Jose Paz",
    fecha: "2024-06-02",
    hora: "13:00",
    laboratorio: "Laboratorio B!",
    alumnos: 22,
    estado: "Rechazado",
    recursos: [
        { tipo: "Equipo", nombre: "Microscopio", cantidad: 2 },
        { tipo: "Material", nombre: "Tubos de ensayo", cantidad: 1 },
        { tipo: "Reactivo", nombre: "Ácido nítrico", cantidad: 8 },
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