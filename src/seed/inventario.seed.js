const mongoose = require("mongoose");
const Item = require("../models/item.model");
const Lote = require("../models/lote.model");
const Actividad = require("../models/actividad.model");
const RecetaReactivo = require("../models/recetaReactivo.model");
const ProduccionReactivo = require("../models/pruduccionReactivo.model");

exports.seedInventario = async () => {
  try {
    // 1. Limpiar las colecciones en orden inverso a sus dependencias
    await ProduccionReactivo.deleteMany({});
    await RecetaReactivo.deleteMany({});
    await Lote.deleteMany({});
    await Actividad.deleteMany({});
    await Item.deleteMany({});

    // 2. Crear Ítems
    const items = await Item.insertMany([
      { tipo: 'material', nombre: 'Tubo de ensayo', codigo: 'MAT-001', unidad: 'unidad', esConsumible: false, requiereReceta: false },
      { tipo: 'sustancia', nombre: 'Agua Destilada', codigo: 'SUS-001', unidad: 'ml', esConsumible: true, requiereReceta: false },
      { tipo: 'sustancia', nombre: 'Cloruro de Sodio', codigo: 'SUS-002', unidad: 'g', esConsumible: true, requiereReceta: false },
      { tipo: 'reactivo', nombre: 'Solución Salina al 5%', codigo: 'REA-001', unidad: 'ml', esConsumible: true, requiereReceta: true }
    ]);

    const tubo = items.find(i => i.codigo === 'MAT-001');
    const agua = items.find(i => i.codigo === 'SUS-001');
    const sal = items.find(i => i.codigo === 'SUS-002');
    const solucionSalina = items.find(i => i.codigo === 'REA-001');

    // 3. Crear Actividades
    const actividades = await Actividad.insertMany([
      { nombre: 'Práctica de Biología Celular', fecha: new Date('2026-06-15T10:00:00Z'), estado: 'planificada' },
      { nombre: 'Preparación de Soluciones', fecha: new Date('2026-05-10T14:00:00Z'), estado: 'finalizada' }
    ]);

    const actPractica = actividades[0];
    const actPrep = actividades[1];

    // 4. Crear Lotes de los ítems
    await Lote.insertMany([
      { itemId: tubo._id, cantidadDisponible: 50, ubicacion: 'Estante A1', estado: 'disponible' },
      { itemId: agua._id, cantidadDisponible: 1000, ubicacion: 'Armario Reactivos', estado: 'disponible', fechaVencimiento: new Date('2028-01-01') },
      { itemId: sal._id, cantidadDisponible: 500, ubicacion: 'Armario Reactivos', estado: 'disponible' },
      { itemId: solucionSalina._id, cantidadDisponible: 200, ubicacion: 'Refrigerador 1', estado: 'reservado', actividadId: actPractica._id }
    ]);

    // 5. Crear la Receta Maestra para el Reactivo
    await RecetaReactivo.insertMany([
      {
        reactivoId: solucionSalina._id,
        composicion: [
          { sustanciaId: agua._id, cantidad: 100, unidad: 'ml' },
          { sustanciaId: sal._id, cantidad: 5, unidad: 'g' }
        ]
      }
    ]);

    // 6. Registrar una Producción del Reactivo (histórico)
    await ProduccionReactivo.insertMany([
      {
        reactivoId: solucionSalina._id,
        composicionReal: [
          { sustanciaId: agua._id, cantidadUsada: 200 },
          { sustanciaId: sal._id, cantidadUsada: 10 }
        ],
        cantidadGenerada: 200,
        fecha: new Date('2026-05-10T15:00:00Z'),
        actividadId: actPrep._id
      }
    ]);

    console.log("Datos semilla de Inventario insertados correctamente.");
  } catch (error) {
    console.error("Error al sembrar el Inventario:", error);
  }
};