/**
 * config/jwt.js
 * Utilidades para la generacion y verificacion de tokens JWT.
 * Centraliza la configuracion (secreto y expiracion) para que
 * los controladores no dependan directamente de jsonwebtoken.
 */

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

/** Secreto para firmar los tokens (desde variables de entorno) */
const JWT_SECRET = process.env.JWT_SECRET || 'facturaexpress_secret_secreto';
/** Tiempo de expiracion del token (ej: 8h, 1d) */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

/**
 * Genera un token JWT para un usuario.
 * @param {object} payload - Datos que viajan dentro del token.
 * @returns {string} Token firmado.
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifica la firma y vigencia de un token JWT.
 * @param {string} token - Token a validar.
 * @returns {object} Payload decodificado del token.
 * @throws {Error} Si el token es invalido o expiro.
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { generateToken, verifyToken };
