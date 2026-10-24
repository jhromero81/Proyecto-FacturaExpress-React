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
  anularFactura,
  getNotasCredito,
  getFacturaPDF,
  getFacturaXML,
  getFacturaCSV,
} = require('../controllers/facturas.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createFacturaValidator,
  updateEstadoFacturaValidator,
  anularFacturaValidator,
  idValidator,
} = require('../validators');

const router = Router();

// Todas las rutas de facturas requieren autenticacion
router.use(authenticate);

router.get('/', listFacturas);
router.post('/', createFacturaValidator, validate, createFactura);
router.get('/:id', idValidator, validate, getFactura);
router.get('/:id/pdf', idValidator, validate, getFacturaPDF);
router.get('/:id/xml', idValidator, validate, getFacturaXML);
router.get('/:id/csv', idValidator, validate, getFacturaCSV);
router.put('/:id/estado', updateEstadoFacturaValidator, validate, updateEstadoFactura);
router.get('/:id/notas-credito', idValidator, validate, getNotasCredito);
router.post('/:id/nota-credito', idValidator, anularFacturaValidator, validate, anularFactura);

// Las facturas no se borran: esta ruta responde 409 y explica la nota credito
router.delete('/:id', idValidator, validate, deleteFactura);

module.exports = router;
