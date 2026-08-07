/**
 * routes/usuarios.routes.js
 * Definicion de las rutas del modulo de usuarios (solo admin).
 */

const { Router } = require('express');
const {
  listUsuarios,
  getUsuario,
  createUsuario,
  updateUsuario,
  toggleActivo,
  deleteUsuario,
} = require('../controllers/usuarios.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin'), listUsuarios);
router.get('/:id', authorize('admin'), getUsuario);
router.post('/', authorize('admin'), createUsuario);
router.put('/:id', authorize('admin'), updateUsuario);
router.patch('/:id/activo', authorize('admin'), toggleActivo);
router.delete('/:id', authorize('admin'), deleteUsuario);

module.exports = router;
