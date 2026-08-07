/**
 * routes/productos.routes.js
 * Definicion de las rutas del modulo de productos.
 */

const { Router } = require('express');
const {
  listProductos,
  getProducto,
  createProducto,
  updateProducto,
  adjustStock,
  deleteProducto,
} = require('../controllers/productos.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

// Todas las rutas de productos requieren autenticacion
router.use(authenticate);

router.get('/', listProductos);
router.get('/:id', getProducto);
router.post('/', createProducto);
router.put('/:id', updateProducto);
router.patch('/:id/stock', adjustStock);
router.delete('/:id', deleteProducto);

module.exports = router;
