/**
 * routes/auth.routes.js
 * Definicion de las rutas del modulo de autenticacion.
 */

const { Router } = require('express');
const { login, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

// POST /api/auth/login - Inicio de sesion (publica)
router.post('/login', login);

// GET /api/auth/me - Usuario autenticado (protegida)
router.get('/me', authenticate, getMe);

module.exports = router;
