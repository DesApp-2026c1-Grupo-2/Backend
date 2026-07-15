import mongoose from "mongoose";
import Pedido from "../models/pedido.model.js";
import Usuario from "../models/usuario.model.js";
import Laboratorio from "../models/laboratorio.model.js";
import Equipo from "../models/equipo.model.js";
import Item from "../models/item.model.js";

/*
 * Seed de pedidos DETERMINISTA y anclado a "ahora" para que el sistema de
 * disponibilidad temporal tenga un abanico realista:
 *   - un pedido Finalizado en el pasado,
 *   - uno Aceptado que transcurre AHORA (reserva En Curso),
 *   - uno Aceptado a futuro (reserva Pendiente),
 *   - uno Pendiente sin aprobar,
 *   - uno Rechazado (equipo fuera de servicio).
 * reserva.seed.js deriva el estado de cada reserva de su ventana vs. ahora, así
 * el estado sembrado es estable frente al cron.
 */

const DIA = 24 * 60 * 60 * 1000;
// Fecha a N días de hoy, con hora fija (para pedidos pasados/futuros).
const enDias = (n, hora = 10) => {
  const d = new Date(Date.now() + n * DIA);
  d.setHours(hora, 0, 0, 0);
  return d;
};

export const seedPedidos = async () => {
  try {
    await Pedido.deleteMany({});

    const docente = await Usuario.findOne({ rol: "DOCENTE" });

    // Laboratorios por nombre (creados por laboratorio.seed.js)
    const labs = await Laboratorio.find();
    const labPorNombre = (frag) => labs.find((l) => l.nombre.includes(frag)) || labs[0];
    const labGeneral = labPorNombre("General");
    const labQuimica = labPorNombre("Química");
    const labFisica = labPorNombre("Física");
    const labBioq = labPorNombre("Bioquímica");

    // Equipos por código
    const equipos = await Equipo.find();
    const eqPorCodigo = (c) => equipos.find((e) => e.codigo === c);
    const micFijo = eqPorCodigo("EQ-MIC-001");   // fijo, en labGeneral, disponible
    const balMovil = eqPorCodigo("EQ-BAL-001");   // móvil, disponible
    const micMovil = eqPorCodigo("EQ-MIC-002");   // móvil, disponible
    const agiFuera = eqPorCodigo("EQ-AGI-001");   // móvil, FUERA DE SERVICIO

    // Ítems por código
    const items = await Item.find();
    const it = (c) => items.find((i) => i.codigo === c);

    if (!docente || !labGeneral || !balMovil || !it("MAT-001")) {
      console.log("⚠️ No se pudieron sembrar los pedidos. Ejecuta primero Usuarios, Laboratorios, Inventario y Equipos.");
      return;
    }

    const pedidosPrueba = [
      // 1. PENDIENTE (sin aprobar, a futuro) — no genera reserva
      {
        materia: "Química General",
        docente: docente._id,
        fechaHora: enDias(4, 10),
        duracionClase: 120,
        laboratorio: labQuimica._id,
        alumnos: 20,
        estado: "Pendiente",
        recursos: [
          { recursoId: balMovil._id, tipoRecurso: "Equipo", cantidad: 1 },
          { recursoId: it("MAT-001")._id, tipoRecurso: "Item", cantidad: 10 },   // Tubo (reutilizable)
          { recursoId: it("SUS-001")._id, tipoRecurso: "Item", cantidad: 500 },  // Agua (consumible)
        ],
      },

      // 2. ACEPTADO a futuro → reserva Pendiente
      {
        materia: "Biología Celular",
        docente: docente._id,
        fechaHora: enDias(2, 14),
        duracionClase: 90,
        laboratorio: labGeneral._id, // micFijo pertenece a labGeneral (coherente)
        alumnos: 15,
        estado: "Aceptado",
        recursos: [
          { recursoId: micFijo._id, tipoRecurso: "Equipo", cantidad: 1 },
          { recursoId: it("MAT-003")._id, tipoRecurso: "Item", cantidad: 50 },  // Pipeta (consumible)
          { recursoId: it("MAT-004")._id, tipoRecurso: "Item", cantidad: 5 },   // Matraz (reutilizable)
        ],
        checklist: [
          { descripcion: "Acondicionar equipo reservado y verificar su funcionamiento.", tipo: "Logistica", estado: "Pendiente" },
          { descripcion: "Colocar materiales y equipos en los carritos destinados al aula.", tipo: "General", estado: "Pendiente" }
        ]
      },

      // 3. RECHAZADO (equipo fuera de servicio) — no genera reserva
      {
        materia: "Física II",
        docente: docente._id,
        fechaHora: enDias(3, 16),
        duracionClase: 120,
        laboratorio: labFisica._id,
        alumnos: 22,
        estado: "Rechazado",
        recursos: [
          { recursoId: agiFuera._id, tipoRecurso: "Equipo", cantidad: 1 },
          { recursoId: it("MAT-002")._id, tipoRecurso: "Item", cantidad: 8 },   // Vaso (reutilizable)
        ],
        detalleProblemas: [
          "El equipo solicitado (Agitador Magnético) está fuera de servicio."
        ]
      },

      // 4. FINALIZADO en el pasado → reserva Finalizada (consumió stock)
      {
        materia: "Química Analítica",
        docente: docente._id,
        fechaHora: enDias(-7, 9),
        duracionClase: 180,
        laboratorio: labQuimica._id,
        alumnos: 18,
        estado: "Finalizado",
        recursos: [
          { recursoId: balMovil._id, tipoRecurso: "Equipo", cantidad: 1 },
          { recursoId: it("SUS-002")._id, tipoRecurso: "Item", cantidad: 300 },  // Cloruro (consumible)
          { recursoId: it("REA-003")._id, tipoRecurso: "Item", cantidad: 250 },  // Etanol (consumible)
        ]
      },

      // 5. ACEPTADO que transcurre AHORA → reserva En Curso (consumiendo stock)
      {
        materia: "Microbiología",
        docente: docente._id,
        fechaHora: new Date(Date.now() - 20 * 60 * 1000), // arrancó hace 20 min
        duracionClase: 120,
        laboratorio: labBioq._id,
        alumnos: 25,
        estado: "Aceptado",
        recursos: [
          { recursoId: micMovil._id, tipoRecurso: "Equipo", cantidad: 1 },
          { recursoId: it("MAT-003")._id, tipoRecurso: "Item", cantidad: 30 },    // Pipeta (consumible)
          { recursoId: it("SUS-001")._id, tipoRecurso: "Item", cantidad: 1000 },  // Agua (consumible)
        ],
        checklist: [
          { descripcion: "Acondicionar equipo reservado y verificar su funcionamiento.", tipo: "Logistica", estado: "Completada" },
          { descripcion: "Colocar materiales y equipos en los carritos destinados al aula.", tipo: "General", estado: "Completada" }
        ]
      },
      // 6. PENDIENTE — Bioquímica, próxima semana
      {
        materia: "Bioquímica I",
        docente: docente._id,
        fechaHora: enDias(5, 9),
        duracionClase: 90,
        laboratorio: labBioq._id,
        alumnos: 18,
        estado: "Pendiente",
        recursos: [
          { recursoId: it("MAT-002")._id, tipoRecurso: "Item", cantidad: 6 },
          { recursoId: it("REA-001")._id, tipoRecurso: "Item", cantidad: 200 },
        ],
      },

      // 7. PENDIENTE — sin laboratorio asignado
      {
        materia: "Física Experimental",
        docente: docente._id,
        fechaHora: enDias(6, 11),
        duracionClase: 120,
        laboratorio: null,
        alumnos: 28,
        estado: "Pendiente",
        recursos: [
          { recursoId: balMovil._id, tipoRecurso: "Equipo", cantidad: 1 },
          { recursoId: it("MAT-001")._id, tipoRecurso: "Item", cantidad: 15 },
        ],
      },

      // 8. RECHAZADO — capacidad insuficiente
      {
        materia: "Química Orgánica",
        docente: docente._id,
        fechaHora: enDias(-2, 10),
        duracionClase: 120,
        laboratorio: labQuimica._id,
        alumnos: 35,
        estado: "Rechazado",
        recursos: [
          { recursoId: it("REA-002")._id, tipoRecurso: "Item", cantidad: 150 },
          { recursoId: it("SUS-002")._id, tipoRecurso: "Item", cantidad: 100 },
        ],
        detalleProblemas: [
          "El laboratorio no tiene capacidad suficiente para la cantidad de alumnos solicitada."
        ],
      },

      // 9. FINALIZADO — hace 3 días
      {
        materia: "Genética Molecular",
        docente: docente._id,
        fechaHora: enDias(-3, 14),
        duracionClase: 150,
        laboratorio: labGeneral._id,
        alumnos: 20,
        estado: "Finalizado",
        recursos: [
          { recursoId: micMovil._id, tipoRecurso: "Equipo", cantidad: 1 },
          { recursoId: it("MAT-003")._id, tipoRecurso: "Item", cantidad: 40 },
          { recursoId: it("SUS-001")._id, tipoRecurso: "Item", cantidad: 500 },
        ],
      },

      // 10. PENDIENTE — aparece en página 2, demuestra la paginación
      {
        materia: "Microbiología Clínica",
        docente: docente._id,
        fechaHora: enDias(8, 10),
        duracionClase: 90,
        laboratorio: labBioq._id,
        alumnos: 22,
        estado: "Pendiente",
        recursos: [
          { recursoId: it("REA-003")._id, tipoRecurso: "Item", cantidad: 100 },
          { recursoId: it("MAT-004")._id, tipoRecurso: "Item", cantidad: 8 },
        ],
      },
    ];

    await Pedido.insertMany(pedidosPrueba);
    console.log(`✅ Se insertaron exitosamente ${pedidosPrueba.length} pedidos de prueba.`);
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
