/**
 * api.js
 * Cliente HTTP de FacturaExpress.
 * Centraliza las peticiones a la API REST del backend y adjunta
 * el token JWT de autenticacion a cada solicitud protegida.
 */

import { storageGet } from './storageService';

/** URL base de la API (configurable por variable de entorno) */
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

/** Token JWT de la sesion activa (se asigna desde AuthContext) */
let authToken = null;

/**
 * Establece el token JWT usado en las peticiones autenticadas.
 * @param {string|null} token - Token de sesion o null para limpiarlo.
 */
export const setAuthToken = (token) => {
  authToken = token;
};

/**
 * Obtiene el token de sesion actual, con respaldo en localStorage.
 * Necesario en recargas completas donde el AuthProvider (padre) todavia
 * no sincronizo el token con el cliente HTTP.
 * @returns {string|null} Token JWT o null.
 */
function getSessionToken() {
  if (authToken) return authToken;
  const stored = storageGet('auth_token', null);
  if (stored) authToken = stored;
  return authToken;
}

/**
 * Ejecuta una peticion HTTP hacia la API y normaliza la respuesta.
 * @param {string} path - Ruta relativa (ej: '/auth/login').
 * @param {object} options - Opciones de fetch (method, body, headers).
 * @returns {Promise<object>} Objeto JSON de la respuesta exitosa.
 * @throws {Error} Con el mensaje devuelto por la API o de red.
 */
async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const config = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };

  // Adjuntar token si existe
  const token = getSessionToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, config);
  } catch (error) {
    throw new Error('No se pudo conectar con el servidor. Verifique que la API este en linea.');
  }

  // Respuestas con cuerpo JSON (la mayoria de endpoints)
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Error en la solicitud.');
    }
    return data;
  }

  // Respuestas con otro contenido (XML, CSV) en caso de exito
  if (!res.ok) {
    throw new Error('Error en la solicitud al servidor.');
  }
  const text = await res.text();
  return { text, filename: extraerFilename(res.headers) };
}

/** Extrae el nombre de archivo sugerido del encabezado Content-Disposition */
function extraerFilename(headers) {
  const disposition = headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  return match ? match[1] : 'descarga';
}

/**
 * Descarga un archivo binario (PDF) adjuntando el token de sesion.
 * @param {string} path - Ruta relativa del recurso a descargar.
 * @returns {Promise<{ blob: Blob, filename: string }>} Blob del archivo.
 */
async function download(path) {
  const token = getSessionToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { headers });
  } catch (error) {
    throw new Error('No se pudo conectar con el servidor. Verifique que la API este en linea.');
  }

  if (!res.ok) {
    let message = 'Error en la solicitud al servidor.';
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        message = data.message || message;
      } catch (e) { /* ignorar */ }
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  return { blob, filename: extraerFilename(res.headers) };
}

/** Descarga el PDF de una factura generado por el backend. */
export const getFacturaPDF = (id) => download(`/facturas/${id}/pdf`);

/** Descarga el PDF del reporte de ventas de un periodo. */
export const getReportePDF = (periodo = 'mensual') => download(`/reportes/pdf?periodo=${periodo}`);

// ============================================================
// Autenticacion
// ============================================================

/**
 * Inicia sesion contra la API.
 * @param {string} nit - NIT del usuario.
 * @param {string} password - Contrasena.
 * @returns {Promise<object>} { token, usuario }.
 */
export const login = (nit, password) =>
  request('/auth/login', { method: 'POST', body: { nit, password } });

/**
 * Consulta el usuario autenticado por el token actual.
 * @returns {Promise<object>} Datos del usuario.
 */
export const getMe = () => request('/auth/me');

// ============================================================
// Clientes
// ============================================================

/** Lista clientes con busqueda opcional. */
export const getClientes = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/clientes${query ? `?${query}` : ''}`);
};

/** Crea un cliente. Body: { identificacion, nombre, email?, telefono? }. */
export const createCliente = (data) =>
  request('/clientes', { method: 'POST', body: data });

/** Actualiza un cliente por id. */
export const updateCliente = (id, data) =>
  request(`/clientes/${id}`, { method: 'PUT', body: data });

/** Elimina logicamente un cliente por id. */
export const deleteCliente = (id) =>
  request(`/clientes/${id}`, { method: 'DELETE' });

// ============================================================
// Productos
// ============================================================

/** Lista productos con busqueda opcional. */
export const getProductos = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/productos${query ? `?${query}` : ''}`);
};

/** Crea un producto. Body: { codigo, nombre, precio, iva?, stock? }. */
export const createProducto = (data) =>
  request('/productos', { method: 'POST', body: data });

/** Actualiza un producto por id. */
export const updateProducto = (id, data) =>
  request(`/productos/${id}`, { method: 'PUT', body: data });

/** Ajusta el stock de un producto. Body: { cantidad }. */
export const adjustProductoStock = (id, cantidad) =>
  request(`/productos/${id}/stock`, { method: 'PATCH', body: { cantidad } });

/** Elimina logicamente un producto por id. */
export const deleteProducto = (id) =>
  request(`/productos/${id}`, { method: 'DELETE' });

// ============================================================
// Facturas / ventas
// ============================================================

/** Lista facturas con filtros (estado, q, pagina, limite). */
export const getFacturas = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/facturas${query ? `?${query}` : ''}`);
};

/** Devuelve una factura completa con sus items. */
export const getFactura = (id) => request(`/facturas/${id}`);

/**
 * Finaliza una venta generando la factura electronica.
 * Body: { clienteId, items: [{ productoId, cantidad }], descuento? }.
 */
export const createFactura = (data) =>
  request('/facturas', { method: 'POST', body: data });

/** Actualiza el estado DIAN de una factura. Body: { estado }. */
export const updateFacturaEstado = (id, estado) =>
  request(`/facturas/${id}/estado`, { method: 'PUT', body: { estado } });

/** Anula una factura por id. */
export const deleteFactura = (id) =>
  request(`/facturas/${id}`, { method: 'DELETE' });

/** Descarga el XML de una factura (formato DIAN). */
export const getFacturaXML = (id) => request(`/facturas/${id}/xml`);

/** Descarga el CSV de una factura. */
export const getFacturaCSV = (id) => request(`/facturas/${id}/csv`);

// ============================================================
// Usuarios (solo admin)
// ============================================================

/** Lista usuarios con busqueda y filtro de rol opcionales. */
export const getUsuarios = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/usuarios${query ? `?${query}` : ''}`);
};

/** Devuelve un usuario por id. */
export const getUsuario = (id) => request(`/usuarios/${id}`);

/** Crea un usuario. Body: { nit, nombre, email?, telefono?, rol?, password }. */
export const createUsuario = (data) =>
  request('/usuarios', { method: 'POST', body: data });

/** Actualiza un usuario por id. */
export const updateUsuario = (id, data) =>
  request(`/usuarios/${id}`, { method: 'PUT', body: data });

/** Activa o desactiva un usuario. Body: { activo }. */
export const toggleUsuarioActivo = (id, activo) =>
  request(`/usuarios/${id}/activo`, { method: 'PATCH', body: { activo } });

/** Elimina un usuario por id. */
export const deleteUsuario = (id) =>
  request(`/usuarios/${id}`, { method: 'DELETE' });

// ============================================================
// Errores del sistema
// ============================================================

/** Lista errores con filtros de tipo y estado. */
export const getErrores = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/errores${query ? `?${query}` : ''}`);
};

/** Marca un error como resuelto. */
export const resolverError = (id) =>
  request(`/errores/${id}/resolver`, { method: 'PATCH' });

// ============================================================
// Auditoria (solo admin)
// ============================================================

/** Lista registros de auditoria con filtros. */
export const getLogs = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/logs${query ? `?${query}` : ''}`);
};

// ============================================================
// Backup (solo admin)
// ============================================================

/** Lista los respaldos disponibles. */
export const getBackups = () => request('/backup');

/** Crea un nuevo respaldo de la base de datos. */
export const crearBackup = () => request('/backup', { method: 'POST' });

/** Restaura la base de datos desde un respaldo. Body: { archivo }. */
export const restaurarBackup = (archivo) =>
  request('/backup/restaurar', { method: 'POST', body: { archivo } });

/** Elimina un respaldo por nombre de archivo. */
export const eliminarBackup = (archivo) =>
  request(`/backup/${encodeURIComponent(archivo)}`, { method: 'DELETE' });

// ============================================================
// Configuracion
// ============================================================

/** Devuelve los datos de la empresa y la configuracion fiscal. */
export const getConfiguracion = () => request('/configuracion');

/** Actualiza los datos de la empresa. */
export const updateEmpresa = (data) =>
  request('/configuracion/empresa', { method: 'PUT', body: data });

/** Actualiza la configuracion fiscal DIAN. */
export const updateFiscal = (data) =>
  request('/configuracion/fiscal', { method: 'PUT', body: data });

/** Simula la sincronizacion con la DIAN. */
export const syncDIAN = () =>
  request('/configuracion/dian/sync', { method: 'POST' });

// ============================================================
// Reportes
// ============================================================

/** Indicadores clave (KPIs) del negocio. */
export const getKPIs = () => request('/reportes/kpis');

/** Ventas por dia de los ultimos 7 dias. */
export const getVentasSemanales = () => request('/reportes/ventas-semanales');

/** Ventas agrupadas por periodo (semanal, mensual, trimestral, anual). */
export const getVentasPeriodo = (periodo = 'mensual') =>
  request(`/reportes/ventas-periodo?periodo=${periodo}`);

/** Productos mas vendidos. */
export const getProductosTop = (limite = 5) =>
  request(`/reportes/productos-top?limite=${limite}`);

/** Ultimas facturas emitidas. */
export const getUltimasTransacciones = (limite = 4) =>
  request(`/reportes/ultimas-transacciones?limite=${limite}`);

/** Historial de reportes generados previamente. */
export const getReportesHistorial = () => request('/reportes/historial');
