/**
 * formatters.test.js
 * Pruebas unitarias de las funciones de formateo y calculo del frontend.
 * Espejo de FacturaExpress-V3/frontend/src/app/core/formatters.spec.ts, para
 * que cualquier divergencia entre las dos implementaciones falle aqui.
 *
 * Ejecutar: npm test
 */

import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  formatShortMoney,
  formatDate,
  timeAgo,
  truncateText,
  escapeHtml,
  calcularIVA,
  calculateVariation,
  generateInvoiceNumber,
} from './formatters';

/** Normaliza el espacio duro que inserta Intl en es-CO para no atar la prueba al ICU del runtime */
const normalizar = (texto) => String(texto).replace(/\u00a0/g, ' ');

describe('formatMoney', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(normalizar(formatMoney(105000))).toBe('$ 105.000');
    expect(normalizar(formatMoney(0))).toBe('$ 0');
    expect(normalizar(formatMoney(1234567))).toBe('$ 1.234.567');
  });

  it('devuelve $0 ante valores no numericos', () => {
    expect(formatMoney(null)).toBe('$0');
    expect(formatMoney(undefined)).toBe('$0');
    expect(formatMoney('abc')).toBe('$0');
    expect(formatMoney(NaN)).toBe('$0');
  });
});

describe('formatShortMoney', () => {
  it('abrevia millones y miles', () => {
    expect(formatShortMoney(1500000)).toBe('$1,5 M');
    expect(formatShortMoney(500000)).toBe('$500 K');
    expect(formatShortMoney(950)).toBe('$950');
  });

  it('devuelve $0 para cero o negativos', () => {
    expect(formatShortMoney(0)).toBe('$0');
    expect(formatShortMoney(-5)).toBe('$0');
  });
});

describe('formatDate', () => {
  it('formatea en dd/mm/aaaa', () => {
    expect(formatDate('2026-10-07T12:00:00')).toBe('07/10/2026');
  });

  it('devuelve -- con entradas vacias o invalidas', () => {
    expect(formatDate(null)).toBe('--');
    expect(formatDate('')).toBe('--');
    expect(formatDate('no-es-fecha')).toBe('--');
  });
});

describe('timeAgo', () => {
  const haceMinutos = (min) => new Date(Date.now() - min * 60000).toISOString();

  it('describe el tiempo transcurrido por tramos', () => {
    expect(timeAgo(new Date().toISOString())).toBe('Reciente');
    expect(timeAgo(haceMinutos(5))).toBe('Hace 5 min');
    expect(timeAgo(haceMinutos(60 * 3))).toBe('Hace 3h');
    expect(timeAgo(haceMinutos(60 * 24 * 2))).toBe('Hace 2d');
  });

  it('cae al formato de fecha despues de una semana', () => {
    const viejo = haceMinutos(60 * 24 * 10);
    expect(timeAgo(viejo)).toBe(formatDate(viejo));
  });

  it('devuelve cadena vacia sin fecha', () => {
    expect(timeAgo(null)).toBe('');
  });
});

describe('truncateText', () => {
  it('no toca textos cortos y recorta los largos', () => {
    expect(truncateText('corto', 10)).toBe('corto');
    expect(truncateText('1234567890', 5)).toBe('12345...');
    expect(truncateText('', 5)).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapa los cinco caracteres peligrosos', () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe(
      '&lt;b&gt;&quot;x&quot; &amp; &#039;y&#039;&lt;/b&gt;'
    );
  });

  it('devuelve cadena vacia con entradas vacias', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
  });
});

describe('calcularIVA', () => {
  it('aplica la tarifa del 19 % y redondea', () => {
    expect(calcularIVA(100000)).toBe(19000);
    expect(calcularIVA(105000)).toBe(19950);
    expect(calcularIVA(0)).toBe(0);
  });

  it('redondea al peso mas cercano', () => {
    expect(calcularIVA(333)).toBe(63); // 63,27 -> 63
    expect(calcularIVA(3333)).toBe(633); // 633,27 -> 633
  });
});

describe('calculateVariation', () => {
  it('calcula la variacion porcentual redondeada', () => {
    expect(calculateVariation(120, 100)).toBe(20);
    expect(calculateVariation(80, 100)).toBe(-20);
    expect(calculateVariation(100, 100)).toBe(0);
  });

  it('trata el anterior en cero sin dividir por cero', () => {
    expect(calculateVariation(50, 0)).toBe(100);
    expect(calculateVariation(0, 0)).toBe(0);
  });
});

describe('generateInvoiceNumber', () => {
  it('sigue el formato FAC-AAAAMM-XXXXX', () => {
    expect(generateInvoiceNumber()).toMatch(/^FAC-\d{6}-\d{5}$/);
  });
});
