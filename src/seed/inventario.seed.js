import mongoose from "mongoose";
import Item from "../models/item.model.js";
import Lote from "../models/lote.model.js";
import Actividad from "../models/actividad.model.js";
import RecetaReactivo from "../models/recetaReactivo.model.js";
import ProduccionReactivo from "../models/produccionReactivo.model.js";

export const seedInventario = async () => {
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

    // 4. Generar Lotes dinámicos y consistentes para todos los ítems
    const lotesGenerados = [];
    for (const item of items) {
      // Creamos entre 2 y 4 lotes por ítem
      const numLotes = Math.floor(Math.random() * 3) + 2; 
      for (let i = 0; i < numLotes; i++) {
        const rand = Math.random();
        const cantidad = rand > 0.85 ? 0 : Math.floor(Math.random() * 80) + 20; // 0 o entre 20-100
        
        lotesGenerados.push({
          itemId: item._id,
          cantidadDisponible: cantidad,
          ubicacion: `Armario ${Math.floor(Math.random() * 5) + 1} - Estante ${String.fromCharCode(65 + i)}`,
          estado: cantidad === 0 ? 'descartado' : (rand > 0.6 ? 'en_uso' : 'disponible'),
          fechaVencimiento: item.esConsumible ? new Date(Date.now() + 31536000000) : null // 1 año de vencimiento a consumibles
        });
      }
    }

    // Sobrescribimos o añadimos un lote forzado para la solución salina y actividad para mantener la prueba original
    lotesGenerados.push({ itemId: solucionSalina._id, cantidadDisponible: 200, ubicacion: 'Refrigerador 1', estado: 'en_uso', actividadId: actPractica._id });
    await Lote.insertMany(lotesGenerados);

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