/**
 * routes/logs.routes.js
 * Definicion de las rutas del modulo de auditoria.
 */

const { Router } = require('express');
const { listLogs } = require('../controllers/logs.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin'), listLogs);

module.exports = router;
