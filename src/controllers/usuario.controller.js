const Usuario = require('../models/usuario.model');
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");

/**
 * Obtener todos los usuarios
 */
const getUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find();
    res.status(200).json(usuarios);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los usuarios', error: error.message });
  }
};

/**
 * Obtener un usuario por ID
 */
const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findById(id);
    
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.status(200).json(usuario);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el usuario', error: error.message });
  }
};

/**
 * Crear un nuevo usuario
 */
const createUsuario = async (req, res) => {
  try {
    const datosUsuario = { ...req.body };
    
    if (datosUsuario.password) {
      const salt = await bcrypt.genSalt(10);
      datosUsuario.password = await bcrypt.hash(datosUsuario.password, salt);
    }
    
    const nuevoUsuario = new Usuario(datosUsuario);
    const usuarioGuardado = await nuevoUsuario.save();
    
    res.status(201).json(usuarioGuardado);
  } catch (error) {
    res.status(400).json({ message: 'Error al crear el usuario', error: error.message });
  }
};

/**
 * Actualizar un usuario existente
 */
const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    
    const datosActualizados = { ...req.body };
    
    if (datosActualizados.password) {
      const salt = await bcrypt.genSalt(10);
      datosActualizados.password = await bcrypt.hash(datosActualizados.password, salt);
    }

    // { new: true } devuelve el documento actualizado
    // { runValidators: true } aplica las validaciones definidas en tu Schema (ej: enums y matches)
    const usuarioActualizado = await Usuario.findByIdAndUpdate(id, datosActualizados, { new: true, runValidators: true });
    
    if (!usuarioActualizado) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.status(200).json(usuarioActualizado);
  } catch (error) {
    res.status(400).json({ message: 'Error al actualizar el usuario', error: error.message });
  }
};

/**
 * Eliminar un usuario
 */
const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioEliminado = await Usuario.findByIdAndDelete(id);
    
    if (!usuarioEliminado) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.status(200).json({ message: 'Usuario eliminado con éxito' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar el usuario', error: error.message });
  }
};

/**
 * Autenticar un usuario (Login)
 */
const login = async (req, res) => {
  try {

    const { email, password } = req.body;

    // Buscar usuario
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      return res.status(401).json({
        message: 'Credenciales inválidas'
      });
    }

    // Comparar password
    const isMatch = await bcrypt.compare(
      password,
      usuario.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: 'Credenciales inválidas'
      });
    }

    // GENERAR JWT
    const token = jwt.sign(
      {
        id: usuario._id,
        email: usuario.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    // RESPUESTA
    res.status(200).json({
      message: 'Login exitoso',
      usuario,
      token
    });

  } catch (error) {

    res.status(500).json({
      message: 'Error al intentar iniciar sesión',
      error: error.message
    });

  }
};

module.exports = {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  login
};