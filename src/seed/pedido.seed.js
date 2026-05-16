//necesito hacer un test de la ruta de pedidos, para eso necesito crear un pedido de prueba, para eso necesito un laboratorio de prueba, para eso necesito un edificio de prueba, para eso necesito una materia de prueba, para eso necesito un docente de prueba, para eso necesito un alumno de prueba, para eso necesito crear un usuario de prueba, para eso necesito crear un rol de prueba
const mongoose = require("mongoose");
const Pedido = require("../models/pedido.model");
const Usuario = require("../models/usuario.model");
const Laboratorio = require("../models/laboratorio.model");
const Equipo = require("../models/equipo.model");
const Item = require("../models/item.model");

exports.seedPedidos = async () => {
  try {
    await Pedido.deleteMany({});

    // Buscamos documentos existentes en la BD para referenciarlos dinámicamente
    const docente = await Usuario.findOne({ rol: "DOCENTE" });
    const laboratorio = await Laboratorio.findOne();
    const equipo = await Equipo.findOne();
    const itemMaterial = await Item.findOne({ tipo: "material" });
    const itemReactivo = await Item.findOne({ tipo: "reactivo" });

    // Verificamos que existan las dependencias antes de intentar insertar
    if (!docente || !laboratorio || !equipo || !itemMaterial || !itemReactivo) {
      console.log("⚠️ No se pudieron sembrar los pedidos. Asegúrate de ejecutar primero los seeds de Usuarios, Laboratorios, Inventario y Equipos.");
      return;
    }

    const pedidosPrueba = [
      {
        materia: "Química General",
        docente: docente._id,
        fechaHora: new Date("2026-06-01T10:00:00"),
        laboratorio: laboratorio._id,
        alumnos: 20,
        estado: "Pendiente",
        recursos: [
          { recursoId: equipo._id, tipoRecurso: "Equipo", cantidad: 1 },
          { recursoId: itemMaterial._id, tipoRecurso: "Item", cantidad: 10 },
          { recursoId: itemReactivo._id, tipoRecurso: "Item", cantidad: 2 },
        ],
      },
      {
        materia: "Biología Celular",
        docente: docente._id,
        fechaHora: new Date("2026-06-02T12:00:00"),
        laboratorio: laboratorio._id,
        alumnos: 15,
        estado: "Aceptado",
        recursos: [
          { recursoId: equipo._id, tipoRecurso: "Equipo", cantidad: 2 },
          { recursoId: itemMaterial._id, tipoRecurso: "Item", cantidad: 5 },
        ],
      },
      {
        materia: "Física II",
        docente: docente._id,
        fechaHora: new Date("2026-06-03T14:00:00"),
        laboratorio: laboratorio._id,
        alumnos: 22,
        estado: "Rechazado",
        recursos: [
          { recursoId: equipo._id, tipoRecurso: "Equipo", cantidad: 3 },
          { recursoId: itemMaterial._id, tipoRecurso: "Item", cantidad: 8 },
        ],
      }
    ];

    await Pedido.insertMany(pedidosPrueba);
    console.log("✅ Pedidos de prueba sembrados correctamente.");
  } catch (error) {
    console.error("❌ Error al sembrar los pedidos:", error);
  }
};