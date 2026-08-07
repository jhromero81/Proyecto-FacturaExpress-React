/**
 * middleware/auth.js
 * Middleware de autenticacion mediante tokens JWT.
 * Protege las rutas de la API: exige que el cliente envie un
 * token valido en el encabezado "Authorization: Bearer <token>".
 */

const { verifyToken } = require('../config/jwt');

/**
 * Middleware de autenticacion.
 * Verifica la presencia y validez del token JWT en la peticion.
 * Si es valido, adjunta el usuario autenticado en req.usuario.
 * @param {object} req - Objeto de peticion de Express.
 * @param {object} res - Objeto de respuesta de Express.
 * @param {function} next - Funcion que continua al siguiente middleware.
 */
function authenticate(req, res, next) {
  // Leer el encabezado Authorization: "Bearer <token>"
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado: se requiere un token de autenticacion.',
    });
  }

  try {
    // Verificar firma y vigencia del token
    const payload = verifyToken(token);
    // Adjuntar la identidad del usuario a la peticion
    req.usuario = { id: payload.id, nit: payload.nit, rol: payload.rol };
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token invalido o expirado.',
    });
  }
}

/**
 * Middleware de autorizacion por rol.
 * Restringe el acceso a un endpoint segun el perfil del usuario.
 * @param {string[]} roles - Lista de roles permitidos.
 * @returns {function} Middleware de Express.
 */
function authorize(...roles) {
  return (req, res, next) => {
    const { rol } = req.usuario || {};
    if (!rol || !roles.includes(rol)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: el rol del usuario no tiene permisos.',
      });
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
