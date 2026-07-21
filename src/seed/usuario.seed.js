import mongoose from "mongoose";
import Usuario from "../models/usuario.model.js";
import bcrypt from "bcrypt";

const usuariosPrueba = [
  {
    nombre: "Admin",
    apellido: "Principal",
    email: "admin@test.com",
    password: "password123", // Se encriptará antes de guardar
    legajo: "ADM001",
    rol: "ADMIN",
    estado: "ACTIVO"
  },
  {
    nombre: "Juan",
    apellido: "Pérez",
    email: "juan.perez@test.com",
    password: "password123",
    legajo: "DOC001",
    rol: "DOCENTE",
    estado: "ACTIVO"
  },
  {
    nombre: "María",
    apellido: "Gómez",
    email: "maria.gomez@test.com",
    password: "password123",
    legajo: "PER001",
    rol: "PERSONAL",
    estado: "PENDIENTE"
  },
  {
    // Docente nuevo SIN pedidos asociados (pedido.seed.js asigna sus pedidos al
    // primer DOCENTE que encuentra, Juan Pérez, así que este queda sin pedidos).
    nombre: "Laura",
    apellido: "Fernández",
    email: "laura.fernandez@test.com",
    password: "password123",
    legajo: "DOC002",
    rol: "DOCENTE",
    estado: "ACTIVO"
  }
];

export const seedUsuarios = async () => {
  try {
    await Usuario.deleteMany({});
    
    const salt = await bcrypt.genSalt(10);
    const usuariosConHash = await Promise.all(usuariosPrueba.map(async (usuario) => {
      const hashedPassword = await bcrypt.hash(usuario.password, salt);
      return { ...usuario, password: hashedPassword };
    }));

    await Usuario.insertMany(usuariosConHash);
    console.log("Usuarios sembrados correctamente");
  } catch (error) {
    console.error("Error al sembrar los usuarios:", error);
  }
};