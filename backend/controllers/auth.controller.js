/**
 * controllers/auth.controller.js
 * Controlador del modulo de autenticacion.
 * Expone la logica de inicio de sesion y consulta del usuario
 * actual autenticado mediante JWT.
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { generateToken } = require('../config/jwt');
const { asyncHandler, createHttpError } = require('../middleware/errorHandler');

/**
 * POST /api/auth/login
 * Inicia sesion validando NIT y contrasena contra la base de
 * datos. En caso de exito devuelve un token JWT y los datos
 * del usuario autenticado.
 *
 * Body: { nit, password }
 */
const login = asyncHandler(async (req, res) => {
  const { nit, password } = req.body || {};

  // Validar que los campos obligatorios fueron enviados
  if (!nit || !password) {
    throw createHttpError(400, 'Debe enviar el NIT y la contrasena.');
  }

  // Buscar el usuario por su NIT
  const [rows] = await pool.query(
    'SELECT id, nit, nombre, email, telefono, rol, password_hash, activo FROM usuarios WHERE nit = ?',
    [nit.trim()]
  );

  if (rows.length === 0) {
    throw createHttpError(401, 'Credenciales incorrectas.');
  }

  const usuario = rows[0];

  // Verificar que el usuario este activo
  if (!usuario.activo) {
    throw createHttpError(403, 'El usuario se encuentra inactivo.');
  }

  // Comparar la contrasena enviada con el hash almacenado
  const passwordValida = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValida) {
    throw createHttpError(401, 'Credenciales incorrectas.');
  }

  // Generar el token JWT con los datos de identidad
  const token = generateToken({
    id: usuario.id,
    nit: usuario.nit,
    rol: usuario.rol,
  });

  // Respuesta sin informacion sensible
  res.json({
    success: true,
    message: 'Inicio de sesion exitoso.',
    token,
    usuario: {
      id: usuario.id,
      nit: usuario.nit,
      nombre: usuario.nombre,
      email: usuario.email,
      telefono: usuario.telefono,
      rol: usuario.rol,
    },
  });
});

/**
 * GET /api/auth/me
 * Devuelve los datos del usuario autenticado con el token.
 * La identidad se obtiene del payload del JWT (req.usuario).
 */
const getMe = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, nit, nombre, email, telefono, rol, activo, created_at FROM usuarios WHERE id = ?',
    [req.usuario.id]
  );

  if (rows.length === 0) {
    throw createHttpError(404, 'Usuario no encontrado.');
  }

  const { password_hash, ...usuarioSeguro } = rows[0];
  res.json({ success: true, usuario: usuarioSeguro });
});

module.exports = { login, getMe };
