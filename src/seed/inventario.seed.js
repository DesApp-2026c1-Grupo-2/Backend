import mongoose from "mongoose";
import Item from "../models/item.model.js";
import Lote from "../models/lote.model.js";
import Laboratorio from "../models/laboratorio.model.js";
import RecetaReactivo from "../models/recetaReactivo.model.js";
import ProduccionReactivo from "../models/produccionReactivo.model.js";

/*
 * Seed de inventario DETERMINISTA y coherente con el modelo de stock temporal
 * (docs/stock-disponibilidad-temporal.md).
 *
 * Decisiones:
 *  - Sin aleatoriedad: cada reseed produce el mismo estado (demos/tests estables).
 *  - Lotes nacen 'disponible'. El consumo físico (decremento de cantidad) lo
 *    aplica reserva.seed.js SOLO para consumibles de reservas En Curso/Finalizada,
 *    imitando el §7. Así el stock refleja qué se usó realmente.
 *  - fechaCreacion escalonada (lotes viejos antes que nuevos) y fechaVencimiento
 *    variada en consumibles → el orden FIFO (vencimiento, creación) es
 *    significativo y reproducible.
 *  - Se incluye un lote 'descartado' (cantidad 0) para ejercitar el "total físico
 *    excluye descartados" (§14) y un lote próximo a vencer.
 */

const DIA = 24 * 60 * 60 * 1000;
const dias = (n) => new Date(Date.now() + n * DIA);

export const seedInventario = async () => {
  try {
    // 1. Limpiar en orden inverso a las dependencias
    await ProduccionReactivo.deleteMany({});
    await RecetaReactivo.deleteMany({});
    await Lote.deleteMany({});
    await Item.deleteMany({});

    // 2. Catálogo de ítems (características generales, sin stock físico)
    const items = await Item.insertMany([
      { tipo: 'material', nombre: 'Tubo de ensayo', codigo: 'MAT-001', unidad: 'unidad', esConsumible: false, requiereReceta: false },
      { tipo: 'material', nombre: 'Vaso de precipitados 250ml', codigo: 'MAT-002', unidad: 'unidad', esConsumible: false },
      { tipo: 'material', nombre: 'Pipeta Pasteur', codigo: 'MAT-003', unidad: 'unidad', esConsumible: true },
      { tipo: 'material', nombre: 'Matraz Erlenmeyer', codigo: 'MAT-004', unidad: 'unidad', esConsumible: false },
      { tipo: 'sustancia', nombre: 'Agua Destilada', codigo: 'SUS-001', unidad: 'ml', esConsumible: true, requiereReceta: false },
      { tipo: 'sustancia', nombre: 'Cloruro de Sodio', codigo: 'SUS-002', unidad: 'g', esConsumible: true, requiereReceta: false },
      { tipo: 'sustancia', nombre: 'Arena fina', codigo: 'SUS-003', unidad: 'g', esConsumible: true },
      { tipo: 'reactivo', nombre: 'Solución Salina al 5%', codigo: 'REA-001', unidad: 'ml', esConsumible: true, requiereReceta: true },
      { tipo: 'reactivo', nombre: 'Ácido Clorhídrico 37%', codigo: 'REA-002', unidad: 'ml', esConsumible: true, requiereReceta: true },
      { tipo: 'reactivo', nombre: 'Etanol 96%', codigo: 'REA-003', unidad: 'ml', esConsumible: true, requiereReceta: false }
    ]);

    const porCodigo = Object.fromEntries(items.map((i) => [i.codigo, i]));

    // Laboratorios (sembrados antes) para ubicar algunos lotes fuera del depósito y
    // así tener datos de prueba de DEVOLUCION (lab → depósito). El resto de lotes
    // quedan con laboratorioId null = depósito. Si el lab no existe, el lote cae al
    // depósito (fallback null) sin romper el seed.
    const labs = await Laboratorio.find({}).select("nombre");
    const labPorNombre = Object.fromEntries(labs.map((l) => [l.nombre, l._id]));

    // 3. Lotes deterministas por ítem.
    //    - Reutilizables: sin vencimiento; el modelo temporal nunca los decrementa.
    //    - Consumibles: con vencimiento variado; incluyen un caso "próximo a vencer".
    //    `lab` (opcional): nombre del laboratorio donde está físicamente el lote;
    //    ausente = depósito.
    const lotesPorCodigo = {
      // Vidriería reutilizable (varios lotes por compras en distintas fechas)
      'MAT-001': [
        { cantidadDisponible: 120, fechaCreacion: dias(-200) },
        // Este lote vive en un laboratorio → sirve para probar la DEVOLUCION al depósito.
        { cantidadDisponible: 60,  fechaCreacion: dias(-60), lab: 'Lab 1 — General' },
        { cantidadDisponible: 0,   fechaCreacion: dias(-200), estado: 'descartado' }, // lote roto/dado de baja
      ],
      'MAT-002': [
        { cantidadDisponible: 45, fechaCreacion: dias(-150) },
        // También en un laboratorio (segundo caso de devolución / transferencia entre labs).
        { cantidadDisponible: 30, fechaCreacion: dias(-30), lab: 'Lab 2 — Química' },
      ],
      'MAT-004': [
        { cantidadDisponible: 40, fechaCreacion: dias(-120) },
      ],
      // Descartable consumible
      'MAT-003': [
        { cantidadDisponible: 200, fechaCreacion: dias(-90),  fechaVencimiento: dias(240) },
        { cantidadDisponible: 150, fechaCreacion: dias(-30),  fechaVencimiento: dias(90) },
      ],
      // Sustancias consumibles
      'SUS-001': [
        { cantidadDisponible: 5000, fechaCreacion: dias(-120), fechaVencimiento: dias(300) },
        { cantidadDisponible: 3000, fechaCreacion: dias(-20),  fechaVencimiento: dias(400) },
      ],
      'SUS-002': [
        { cantidadDisponible: 2000, fechaCreacion: dias(-100), fechaVencimiento: dias(180) },
        { cantidadDisponible: 1000, fechaCreacion: dias(-10),  fechaVencimiento: dias(7) }, // próximo a vencer
      ],
      'SUS-003': [
        { cantidadDisponible: 5000, fechaCreacion: dias(-80), fechaVencimiento: dias(720) },
      ],
      // Reactivos
      'REA-001': [
        { cantidadDisponible: 200, fechaCreacion: dias(-50), fechaVencimiento: dias(60) },
      ],
      'REA-002': [
        { cantidadDisponible: 1000, fechaCreacion: dias(-70), fechaVencimiento: dias(120) },
      ],
      'REA-003': [
        { cantidadDisponible: 2000, fechaCreacion: dias(-40), fechaVencimiento: dias(500) },
      ],
    };

    const lotesGenerados = [];
    for (const [codigo, lotes] of Object.entries(lotesPorCodigo)) {
      const item = porCodigo[codigo];
      for (const l of lotes) {
        lotesGenerados.push({
          itemId: item._id,
          cantidadDisponible: l.cantidadDisponible,
          // Depósito (null) por defecto; algunos lotes se ubican en un laboratorio.
          laboratorioId: l.lab ? (labPorNombre[l.lab] ?? null) : null,
          estado: l.estado || 'disponible',
          fechaCreacion: l.fechaCreacion,
          // Solo consumibles llevan vencimiento (los reutilizables no vencen).
          fechaVencimiento: item.esConsumible ? (l.fechaVencimiento ?? dias(365)) : null,
        });
      }
    }

    await Lote.insertMany(lotesGenerados);

    // 4. Receta maestra del reactivo con receta (Solución Salina)
    const agua = porCodigo['SUS-001'];
    const sal = porCodigo['SUS-002'];
    const solucionSalina = porCodigo['REA-001'];

    await RecetaReactivo.insertMany([
      {
        reactivoId: solucionSalina._id,
        composicion: [
          { sustanciaId: agua._id, cantidad: 100, unidad: 'ml' },
          { sustanciaId: sal._id, cantidad: 5, unidad: 'g' }
        ]
      }
    ]);

    // 5. Producción histórica del reactivo
    await ProduccionReactivo.insertMany([
      {
        reactivoId: solucionSalina._id,
        composicionReal: [
          { sustanciaId: agua._id, cantidadUsada: 200 },
          { sustanciaId: sal._id, cantidadUsada: 10 }
        ],
        cantidadGenerada: 200,
        fecha: dias(-50)
      }
    ]);

    console.log("Datos semilla de Inventario insertados correctamente.");
  } catch (error) {
    console.error("Error al sembrar el Inventario:", error);
  }
};
