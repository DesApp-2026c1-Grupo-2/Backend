import mongoose from "mongoose";
import Pedido from "../models/pedido.model.js";
import Usuario from "../models/usuario.model.js";
import Laboratorio from "../models/laboratorio.model.js";
import Equipo from "../models/equipo.model.js";
import Item from "../models/item.model.js";

export const seedPedidos = async () => {
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
        duracionClase: 120,
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
        duracionClase: 90,
        laboratorio: laboratorio._id,
        alumnos: 15,
        estado: "Aceptado",
        recursos: [
          { recursoId: equipo._id, tipoRecurso: "Equipo", cantidad: 2 },
          { recursoId: itemMaterial._id, tipoRecurso: "Item", cantidad: 5 },
        ],
        checklist: [
          { descripcion: "Acondicionar equipo reservado y verificar su funcionamiento.", tipo: "Logistica", estado: "Completada" },
          { descripcion: "Colocar todos los materiales, equipos y reactivos en los carritos destinados al aula.", tipo: "General", estado: "Pendiente" }
        ]
      },
      {
        materia: "Física II",
        docente: docente._id,
        fechaHora: new Date("2026-06-03T14:00:00"),
        duracionClase: 120,
        laboratorio: laboratorio._id,
        alumnos: 22,
        estado: "Rechazado",
        recursos: [
          { recursoId: equipo._id, tipoRecurso: "Equipo", cantidad: 3 },
          { recursoId: itemMaterial._id, tipoRecurso: "Item", cantidad: 8 },
        ],
        detalleProblemas: [
          "El equipo no se encuentra disponible en esa fecha",
          "Stock insuficiente del material solicitado"
        ]
      },
      {
        materia: "Química Analítica",
        docente: docente._id,
        fechaHora: new Date("2026-06-05T08:00:00"),
        duracionClase: 180,
        laboratorio: laboratorio._id,
        alumnos: 18,
        estado: "Finalizado",
        recursos: [
          { recursoId: equipo._id, tipoRecurso: "Equipo", cantidad: 1 },
          { recursoId: itemReactivo._id, tipoRecurso: "Item", cantidad: 5 }
        ]
      }
    ];

    if (pedidosPrueba.length > 0) {
      await Pedido.insertMany(pedidosPrueba);
      console.log(`✅ Se insertaron exitosamente ${pedidosPrueba.length} pedidos de prueba.`);
    }
  } catch (error) {
    console.error("❌ Error al sembrar los pedidos:", error);
  }
};

export const rollbackPedidos = async () => {
  try {
    await Pedido.deleteMany({});
    console.log("⏪ Rollback: Pedidos eliminados correctamente.");
  } catch (error) {
    console.error("❌ Error al revertir los pedidos:", error);
  }
};