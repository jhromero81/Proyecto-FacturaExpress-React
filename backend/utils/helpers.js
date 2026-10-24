/**
 * utils/helpers.js
 * Funciones auxiliares de logica de negocio de FacturaExpress:
 * generacion de numeros de factura, calculo de IVA, validaciones
 * de entrada y limpieza de objetos de respuesta.
 */

const { pool } = require('../config/db');

/** Tasa de IVA configurable (19% en Colombia) */
const IVA_RATE = 0.19;

/**
 * Calcula el IVA de un valor base redondeado a enteros.
 * @param {number} base - Valor base sin IVA.
 * @returns {number} Monto de IVA calculado.
 */
function calcularIVA(base) {
  return Math.round(base * IVA_RATE);
}

/**
 * Genera el siguiente numero consecutivo de un documento.
 *
 * La secuencia vive en la tabla `consecutivos` y se incrementa con un
 * upsert atomico (`ultimo = ultimo + 1`) dentro de la transaccion del
 * documento. Consecuencias frente al COUNT(*) anterior:
 *  - Dos ventas simultaneas nunca obtienen el mismo numero (el upsert
 *    bloquea la fila hasta el commit).
 *  - Borrar o anular un documento no hace retroceder el consecutivo,
 *    por lo que no se repiten numeros ya usados.
 *
 * @param {object} connection - Conexion dentro de la transaccion.
 * @param {string} [prefijo] - Prefijo del documento (FAC, NC...).
 * @returns {Promise<string>} Numero con formato PREFIJO-YYYYMM-00001.
 */
async function generarNumeroFactura(connection, prefijo = 'FAC') {
  const ahora = new Date();
  const periodo = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  const clave = `${prefijo}-${periodo}`;

  await connection.query(
    `INSERT INTO consecutivos (clave, ultimo) VALUES (?, LAST_INSERT_ID(1))
       ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)`,
    [clave]
  );

  const [filas] = await connection.query('SELECT LAST_INSERT_ID() AS ultimo');
  const secuencia = Number(filas[0].ultimo);
  return `${clave}-${String(secuencia).padStart(5, '0')}`;
}

/**
 * Genera el numero secuencial de una factura con el formato
 * FAC-YYYYMM-XXXXX, donde XXXXX es la siguiente posicion de la
 * secuencia dentro del mes actual. Si no hay facturas en el mes,
 * la secuencia inicia en 1.
 * @returns {Promise<string>} Numero de factura generado.
 */
async function generateInvoiceNumber() {
  const ahora = new Date();
  const year = ahora.getFullYear();
  const month = String(ahora.getMonth() + 1).padStart(2, '0');
  const prefix = `FAC-${year}${month}-`;

  // Contar facturas emitidas en el mes actual
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM facturas
      WHERE numero LIKE ?`,
    [`${prefix}%`]
  );

  const secuencia = Number(rows[0].total) + 1;
  return `${prefix}${String(secuencia).padStart(5, '0')}`;
}

/**
 * Verifica que un valor sea un entero positivo.
 * @param {*} value - Valor a comprobar.
 * @returns {boolean} true si es un entero mayor que cero.
 */
function isValidPositiveInt(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

/**
 * Verifica que un campo obligatorio de tipo texto este presente.
 * @param {*} value - Valor a comprobar.
 * @returns {boolean} true si el campo tiene contenido.
 */
function isRequiredString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Convierte una fila numerica de MySQL a la estructura que
 * consume el frontend (items de factura).
 * @param {object} row - Fila de la tabla factura_items.
 * @returns {object} Item normalizado.
 */
function mapItemRow(row) {
  return {
    id: row.producto_id,
    codigo: row.codigo,
    nombre: row.nombre,
    cantidad: row.cantidad,
    precioUnitario: Number(row.precio_unitario),
    iva: Number(row.iva),
    subtotal: Number(row.subtotal),
  };
}

/**
 * Normaliza una fila de la tabla facturas a la estructura JSON
 * que usa el frontend (p.ej. factura.cliente, factura.total).
 * @param {object} row - Fila de la tabla facturas.
 * @returns {object} Factura normalizada.
 */
function mapFacturaRow(row) {
  return {
    id: row.id,
    numero: row.numero,
    fecha: row.fecha instanceof Date ? row.fecha.toISOString() : row.fecha,
    cliente: {
      id: row.cliente_id,
      identificacion: row.cliente_identificacion,
      nombre: row.cliente_nombre,
    },
    subtotal: Number(row.subtotal),
    iva: Number(row.iva),
    descuento: Number(row.descuento),
    total: Number(row.total),
    estado: row.estado,
    medioPago: row.medio_pago || 'efectivo',
    plazoDias: row.plazo_dias === null || row.plazo_dias === undefined ? null : Number(row.plazo_dias),
    fechaVencimiento: row.fecha_vencimiento
      ? (row.fecha_vencimiento instanceof Date
          ? row.fecha_vencimiento.toISOString().slice(0, 10)
          : String(row.fecha_vencimiento).slice(0, 10))
      : null,
    cufe: row.cufe || null,
    firmaEstado: row.firma_estado || 'pendiente',
    intentosDian: Number(row.intentos_dian || 0),
    correoEnviado: Boolean(row.correo_enviado),
  };
}

/**
 * Normaliza una fila de la tabla clientes a la estructura JSON
 * del frontend (identificacion, nombre, email, telefono).
 * @param {object} row - Fila de la tabla clientes.
 * @returns {object} Cliente normalizado.
 */
function mapClienteRow(row) {
  return {
    id: row.id,
    identificacion: row.identificacion,
    nombre: row.nombre,
    email: row.email || '',
    telefono: row.telefono || '',
  };
}

/**
 * Normaliza una fila de la tabla productos a la estructura JSON
 * del frontend (codigo, nombre, precio, iva, stock).
 * @param {object} row - Fila de la tabla productos.
 * @returns {object} Producto normalizado.
 */
function mapProductoRow(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    precio: Number(row.precio),
    iva: Number(row.iva),
    stock: row.stock,
  };
}

/**
 * Escapa caracteres especiales de un valor para incrustarlo de forma
 * segura en un documento XML (evita XML invalido por nombres o textos
 * que contengan &, <, >, " o ').
 * @param {*} value - Valor a escapar.
 * @returns {string} Texto seguro para XML.
 */
function escapeXML(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escapa un valor para un archivo CSV (RFC 4180): se entrecomilla si
 * contiene comas, comillas dobles o saltos de linea, duplicando las
 * comillas internas.
 * @param {*} value - Valor a escapar.
 * @returns {string} Valor seguro para CSV.
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

module.exports = {
  IVA_RATE,
  calcularIVA,
  generateInvoiceNumber,
  isValidPositiveInt,
  isRequiredString,
  escapeXML,
  escapeCSV,
  mapItemRow,
  mapFacturaRow,
  generarNumeroFactura,
  mapClienteRow,
  mapProductoRow,
};
