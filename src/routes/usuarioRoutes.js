const { Router } = require('express');
const router = Router();

const { validarJWT } = require('../middlewares/validateJWT.js');

const {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  login
} = require('../controllers/usuario.controller');

// Ruta para iniciar sesión (Login)
router.post('/login', login);

// Rutas CRUD para Usuarios
router.get('/', validarJWT, getUsuarios);

router.get('/:id', validarJWT, getUsuarioById);

// Ruta pública para registro de usuarios
router.post('/', createUsuario);

router.put('/:id', validarJWT, updateUsuario);

router.delete('/:id', validarJWT, deleteUsuario);

module.exports = router;