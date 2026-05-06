const mongoose = require("mongoose");

const recursoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ["Equipo", "Material", "Reactivo"],
    required: true,
  },
  nombre: {
    type: String,
    required: true,
  },
  cantidad: {
    type: Number,
    required: true,
    min: 1,
  },
});

const pedidoSchema = new mongoose.Schema({
  materia: {
    type: String,
    required: true,
  },
  docente: {
    type: String,
    required: true,
  },
  fecha: {
    type: String,
    required: true,
  },
  hora: {
    type: String,
    required: true,
  },
  laboratorio: {
    type: String,
    required: true,
  },
  alumnos: {
    type: Number,
    required: true,
  },
  estado: {
    type: String,
    enum: ["Pendiente", "En Revisión", "Aceptado", "Rechazado"],
    default: "Pendiente",
  },
  recursos: [recursoSchema],
  problemas: {
    type: Number,
    default: 0,
  },
  detalleProblemas: {
    type: [String],
    default: [],
  },
});

module.exports = mongoose.model("pedidos", pedidoSchema);