/**
 * formatters.js
 * Funciones de formateo para datos monetarios, fechas y textos.
 * Utilizadas en toda la aplicacion para mantener consistencia visual.
 */

import { IVA_RATE } from './constants';

/**
 * Formatea un valor numerico como moneda colombiana (COP).
 * @param {number} valor - Cantidad a formatear.
 * @returns {string} Cadena formateada como pesos colombianos.
 */
export const formatMoney = (valor) => {
  if (typeof valor !== 'number' || isNaN(valor)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
};

/**
 * Formatea una cadena ISO o Date a formato local colombiano.
 * @param {string|Date} fechaStr - Fecha a formatear.
 * @returns {string} Fecha formateada (dd/mm/yyyy).
 */
export const formatDate = (fechaStr) => {
  if (!fechaStr) return '--';
  const fecha = new Date(fechaStr);
  if (isNaN(fecha.getTime())) return '--';
  return fecha.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Genera un timestamp relativo (hace X minutos, horas, etc.).
 * @param {string|Date} fechaStr - Fecha de referencia.
 * @returns {string} Texto descriptivo del tiempo transcurrido.
 */
export const timeAgo = (fechaStr) => {
  if (!fechaStr) return '';
  const ahora = new Date();
  const fecha = new Date(fechaStr);
  const diffMs = ahora - fecha;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDias = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Reciente';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHrs < 24) return `Hace ${diffHrs}h`;
  if (diffDias < 7) return `Hace ${diffDias}d`;
  return formatDate(fechaStr);
};

/**
 * Genera un numero de factura unico con formato FAC-YYYYMM-XXXXX.
 * @returns {string} Numero de factura generado.
 */
export const generateInvoiceNumber = () => {
  const ahora = new Date();
  const year = ahora.getFullYear();
  const month = String(ahora.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0');
  return `FAC-${year}${month}-${seq}`;
};

/**
 * Trunca un texto largo agregando puntos suspensivos.
 * @param {string} texto - Texto original.
 * @param {number} maxLen - Longitud maxima permitida.
 * @returns {string} Texto truncado.
 */
export const truncateText = (texto, maxLen = 50) => {
  if (!texto || texto.length <= maxLen) return texto || '';
  return texto.substring(0, maxLen) + '...';
};

/**
 * Escapa caracteres HTML para prevenir inyeccion XSS.
 * @param {string} str - Cadena a sanitizar.
 * @returns {string} Cadena segura para insertar en el DOM.
 */
export const escapeHtml = (str) => {
  if (!str) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, (char) => map[char]);
};

/**
 * Calcula el IVA de un valor base.
 * @param {number} base - Valor base sobre el cual calcular IVA.
 * @returns {number} Monto del IVA calculado.
 */
export const calcularIVA = (base) => {
  return Math.round(base * IVA_RATE);
};

/**
 * Calcula el porcentaje de cambio entre dos valores.
 * @param {number} actual - Valor actual.
 * @param {number} anterior - Valor anterior.
 * @returns {number} Porcentaje de variacion.
 */
export const calculateVariation = (actual, anterior) => {
  if (anterior === 0) return actual > 0 ? 100 : 0;
  return Math.round(((actual - anterior) / anterior) * 100);
};
