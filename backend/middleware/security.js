/**
 * middleware/security.js
 * Middlewares de seguridad de la API:
 *  - loginLimiter: limita los intentos de inicio de sesion para
 *    prevenir ataques de fuerza bruta.
 *  - apiLimiter: limita el trafico general de la API.
 */

const rateLimit = require('express-rate-limit');

/**
 * Limite estricto para el endpoint de inicio de sesion.
 * Permite 5 intentos cada 15 minutos por direccion IP.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
  limit: 5, // Maximo de intentos por ventana
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesion. Intente de nuevo en 15 minutos.',
  },
});

/**
 * Limite general de la API.
 * Permite 120 peticiones por minuto por direccion IP.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // Ventana de 1 minuto
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas peticiones. Intente de nuevo en un minuto.',
  },
});

/** Metodos que cambian estado: solo estos pasan por el control de origen */
const METODOS_MUTANTES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Lista de origenes autorizados a enviar peticiones mutantes.
 * Se toma de CORS_ORIGINS (lista separada por comas) y, si no existe,
 * de CORS_ORIGIN mas los puertos de desarrollo habituales.
 * @returns {Set<string>}
 */
function origenesPermitidos() {
  const crudo = process.env.CORS_ORIGINS || '';
  const lista = crudo
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const base = [
    process.env.CORS_ORIGIN || 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:4200',
  ];

  return new Set([...base, ...lista]);
}

/**
 * Verifica el encabezado Origin en peticiones que cambian estado.
 *
 * Con la sesion en una cookie httpOnly el navegador adjunta la cookie a
 * cualquier peticion que salga del sitio aunque el origen sea ajeno (CSRF).
 * `SameSite=Lax` ya bloquea la mayoria de esos envios, pero no todos los
 * navegadores ni todos los casos: comprobar Origin es la segunda capa.
 *
 * Si la peticion no trae Origin (curl, Postman, pruebas automatizadas) se
 * deja pasar: no hay navegador adjuntando cookies de otro sitio. Si lo trae
 * y no esta en la lista, se responde 403.
 *
 * @type {import('express').RequestHandler}
 */
function verificarOrigen(req, res, next) {
  if (!METODOS_MUTANTES.has(req.method)) return next();

  const origen = req.get('origin');
  if (!origen) return next();

  if (origenesPermitidos().has(origen)) return next();

  return res.status(403).json({
    success: false,
    message: 'Origen no autorizado para esta operacion.',
  });
}

module.exports = { loginLimiter, apiLimiter, verificarOrigen, origenesPermitidos };
