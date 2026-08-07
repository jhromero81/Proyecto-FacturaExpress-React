/**
 * routes/facturas.routes.js
 * Definicion de las rutas del modulo de ventas y facturacion.
 */

const { Router } = require('express');
const {
  listFacturas,
  getFactura,
  createFactura,
  updateEstadoFactura,
  deleteFactura,
  getFacturaPDF,
  getFacturaXML,
  getFacturaCSV,
} = require('../controllers/facturas.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

// Todas las rutas de facturas requieren autenticacion
router.use(authenticate);

router.get('/', listFacturas);
router.post('/', createFactura);
router.get('/:id', getFactura);
router.get('/:id/pdf', getFacturaPDF);
router.get('/:id/xml', getFacturaXML);
router.get('/:id/csv', getFacturaCSV);
router.put('/:id/estado', updateEstadoFactura);
router.delete('/:id', deleteFactura);

module.exports = router;
