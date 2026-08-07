/**
 * routes/clientes.routes.js
 * Definicion de las rutas del modulo de clientes.
 */

const { Router } = require('express');
const {
  listClientes,
  getCliente,
  createCliente,
  updateCliente,
  deleteCliente,
} = require('../controllers/clientes.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

// Todas las rutas de clientes requieren autenticacion
router.use(authenticate);

router.get('/', listClientes);
router.get('/:id', getCliente);
router.post('/', createCliente);
router.put('/:id', updateCliente);
router.delete('/:id', deleteCliente);

module.exports = router;
