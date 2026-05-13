const { Router } = require('express');
const router = Router();

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
router.get('/', getUsuarios);
router.get('/:id', getUsuarioById);
router.post('/', createUsuario);
router.put('/:id', updateUsuario);
router.delete('/:id', deleteUsuario);

module.exports = router;