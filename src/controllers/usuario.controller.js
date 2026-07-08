import Usuario from '../models/usuario.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { enviarMailAprobacion } from '../services/emailService.js';

const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 200;

// Normaliza page/limit de la query a enteros acotados (evita traer la colección
// completa). Devuelve { page, limit, skip }.
const parsePaginacion = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limitPedido = parseInt(query.limit, 10) || LIMIT_DEFAULT;
  const limit = Math.min(Math.max(1, limitPedido), LIMIT_MAX);
  return { page, limit, skip: (page - 1) * limit };
};

/**
 * Obtener todos los usuarios (paginado)
 */
const getUsuarios = async (req, res) => {
  try {
    const filtros = { activo: { $ne: false } };
    const { page, limit, skip } = parsePaginacion(req.query);

    const [usuarios, total] = await Promise.all([
      Usuario.find(filtros)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Usuario.countDocuments(filtros)
    ]);

    res.status(200).json({ total, page, limit, usuarios });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los usuarios', error: error.message });
  }
};

/**
 * Obtener los usuarios pendientes de aprobación (paginado)
 */
const getUsuariosPendientes = async (req, res) => {
  try {
    const filtros = { estado: 'PENDIENTE', activo: { $ne: false } };
    const { page, limit, skip } = parsePaginacion(req.query);

    const [usuarios, total] = await Promise.all([
      Usuario.find(filtros)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Usuario.countDocuments(filtros)
    ]);

    res.status(200).json({ total, page, limit, usuarios });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los usuarios pendientes', error: error.message });
  }
};

/**
 * Aprobar un usuario pendiente (PENDIENTE -> ACTIVO)
 * Notifica al usuario por correo (best-effort: un fallo de mail no
 * revierte la aprobación).
 */
const aprobarUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await Usuario.findOne({ _id: id, activo: { $ne: false } });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (usuario.estado !== 'PENDIENTE') {
      return res.status(409).json({ message: 'El usuario no está pendiente de aprobación' });
    }

    usuario.estado = 'ACTIVO';
    await usuario.save();

    // Notificación por correo: best-effort, no debe romper la aprobación.
    try {
      await enviarMailAprobacion(usuario);
    } catch (mailError) {
      console.error('Error al enviar el correo de aprobación:', mailError.message);
    }

    res.status(200).json({ message: 'Usuario aprobado correctamente', usuario });
  } catch (error) {
    res.status(500).json({ message: 'Error al aprobar el usuario', error: error.message });
  }
};

/**
 * Obtener un usuario por ID
 */
const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findOne({ _id: id, activo: { $ne: false } });
    
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
    
    if (datosUsuario.legajo !== undefined && String(datosUsuario.legajo).trim() === '') {
      delete datosUsuario.legajo;
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

    // Validar por seguridad que un usuario no escale sus propios privilegios accidentalmente
    // (Si este endpoint es consumido por administradores, este chequeo debería omitirse
    // o extraerse basándose en el rol del usuario que realiza la petición req.usuario.rol)
    delete datosActualizados.rol;
    delete datosActualizados.activo;

    if (datosActualizados.legajo !== undefined && String(datosActualizados.legajo).trim() === '') {
      datosActualizados.$unset = { legajo: 1 };
      delete datosActualizados.legajo;
    }

    // { new: true } devuelve el documento actualizado
    // { runValidators: true } aplica las validaciones definidas en tu Schema (ej: enums y matches)
    const usuarioActualizado = await Usuario.findOneAndUpdate(
      { _id: id, activo: { $ne: false } },
      datosActualizados,
      { new: true, runValidators: true }
    );
    
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
    const usuarioEliminado = await Usuario.findOneAndUpdate(
      { _id: id, activo: { $ne: false } },
      { activo: false },
      { new: true }
    );
    
    if (!usuarioEliminado) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.status(200).json({ message: 'Usuario marcado como eliminado (borrado lógico)', usuario: usuarioEliminado });
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

    // Buscar usuario activo
    const usuario = await Usuario.findOne({ email, activo: { $ne: false } });

    if (!usuario) {
      return res.status(401).json({
        message: 'Credenciales inválidas'
      });
    }

    // Comparar password usando método del modelo
    const isMatch = await usuario.compararPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        message: 'Credenciales inválidas'
      });
    }

    // Bloquear el acceso a cuentas que no estén activas (pendientes de
    // aprobación o suspendidas).
    if (usuario.estado !== 'ACTIVO') {
      const mensaje = usuario.estado === 'PENDIENTE'
        ? 'Tu cuenta está pendiente de aprobación'
        : 'Tu cuenta se encuentra suspendida';

      return res.status(403).json({ message: mensaje });
    }

    // GENERAR JWT
    const token = jwt.sign(
      {
        id: usuario._id,
        email: usuario.email,
        rol: usuario.rol
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

/**
 * Verificar token de autenticación
 */
const verify = async (req, res) => {
  try {

    const usuario = await Usuario.findById(req.usuario.id);

    if (!usuario) {
      return res.status(401).json({
        message: "Usuario no encontrado"
      });
    }

    res.status(200).json({
      ok: true,
      usuario
    });

  } catch (error) {

    res.status(500).json({
      message: "Error al verificar token"
    });

  }
};

export {
  getUsuarios,
  getUsuariosPendientes,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  aprobarUsuario,
  login,
  verify,
};