/**
 * preferences.test.js
 * Pruebas de las reglas de los modos de visualizacion.
 * Lo importante: el modo oscuro y el alto contraste nunca pueden quedar
 * activos a la vez, venga el cambio de donde venga.
 */
import { describe, it, expect } from 'vitest';
import {
  alternarModo,
  aplicarCambios,
  modoActivo,
  normalizarPreferencias,
  MODOS_EXCLUYENTES,
} from './preferences';

const base = { modoOscuro: false, altoContraste: false, tamanoTexto: 'medium' };

describe('normalizarPreferencias', () => {
  it('deja intactas las preferencias validas (misma referencia)', () => {
    expect(normalizarPreferencias(base)).toBe(base);
  });

  it('conserva el modo oscuro cuando el alto contraste esta apagado', () => {
    const prefs = { ...base, modoOscuro: true };
    expect(normalizarPreferencias(prefs)).toBe(prefs);
  });

  it('conserva el alto contraste cuando el modo oscuro esta apagado', () => {
    const prefs = { ...base, altoContraste: true };
    expect(normalizarPreferencias(prefs)).toBe(prefs);
  });

  it('apaga el modo oscuro si llegan los dos activos (gana el alto contraste)', () => {
    const resultado = normalizarPreferencias({ ...base, modoOscuro: true, altoContraste: true });
    expect(resultado.altoContraste).toBe(true);
    expect(resultado.modoOscuro).toBe(false);
  });

  it('no pierde el tamano de texto al normalizar', () => {
    const resultado = normalizarPreferencias({
      modoOscuro: true,
      altoContraste: true,
      tamanoTexto: 'large',
    });
    expect(resultado.tamanoTexto).toBe('large');
  });
});

describe('alternarModo', () => {
  it('enciende el modo oscuro desde el tema claro', () => {
    const r = alternarModo(base, 'modoOscuro');
    expect(r.modoOscuro).toBe(true);
    expect(r.altoContraste).toBe(false);
  });

  it('enciende el alto contraste desde el tema claro', () => {
    const r = alternarModo(base, 'altoContraste');
    expect(r.altoContraste).toBe(true);
    expect(r.modoOscuro).toBe(false);
  });

  it('al encender el alto contraste apaga el modo oscuro', () => {
    const oscuro = alternarModo(base, 'modoOscuro');
    const r = alternarModo(oscuro, 'altoContraste');
    expect(r.altoContraste).toBe(true);
    expect(r.modoOscuro).toBe(false);
    expect(modoActivo(r)).toBe('altoContraste');
  });

  it('al encender el modo oscuro apaga el alto contraste', () => {
    const contraste = alternarModo(base, 'altoContraste');
    const r = alternarModo(contraste, 'modoOscuro');
    expect(r.modoOscuro).toBe(true);
    expect(r.altoContraste).toBe(false);
    expect(modoActivo(r)).toBe('modoOscuro');
  });

  it('al apagar el modo activo vuelve al tema claro', () => {
    const oscuro = alternarModo(base, 'modoOscuro');
    const r = alternarModo(oscuro, 'modoOscuro');
    expect(r.modoOscuro).toBe(false);
    expect(r.altoContraste).toBe(false);
    expect(modoActivo(r)).toBe('claro');
  });

  it('nunca deja los dos modos activos en una secuencia larga de pulsaciones', () => {
    let prefs = base;
    for (const modo of [
      'modoOscuro', 'altoContraste', 'modoOscuro', 'modoOscuro',
      'altoContraste', 'altoContraste', 'modoOscuro', 'altoContraste',
    ]) {
      prefs = alternarModo(prefs, modo);
      expect(prefs.modoOscuro && prefs.altoContraste).toBe(false);
    }
  });

  it('conserva las demas preferencias', () => {
    const r = alternarModo({ ...base, tamanoTexto: 'large' }, 'altoContraste');
    expect(r.tamanoTexto).toBe('large');
  });

  it('rechaza un modo desconocido', () => {
    expect(() => alternarModo(base, 'modoSepia')).toThrow(/desconocido/);
  });
});

describe('aplicarCambios', () => {
  it('enciende el modo oscuro y apaga el alto contraste', () => {
    const r = aplicarCambios({ ...base, altoContraste: true }, { modoOscuro: true });
    expect(r.modoOscuro).toBe(true);
    expect(r.altoContraste).toBe(false);
  });

  it('enciende el alto contraste y apaga el modo oscuro', () => {
    const r = aplicarCambios({ ...base, modoOscuro: true }, { altoContraste: true });
    expect(r.altoContraste).toBe(true);
    expect(r.modoOscuro).toBe(false);
  });

  it('permite apagar un modo sin tocar el otro', () => {
    const r = aplicarCambios({ ...base, altoContraste: true }, { altoContraste: false });
    expect(r.altoContraste).toBe(false);
    expect(r.modoOscuro).toBe(false);
  });

  it('no enciende nada cuando el cambio solo toca el tamano de texto', () => {
    const r = aplicarCambios(base, { tamanoTexto: 'large' });
    expect(r.modoOscuro).toBe(false);
    expect(r.altoContraste).toBe(false);
    expect(r.tamanoTexto).toBe('large');
  });

  it('corrige un estado de partida invalido', () => {
    const r = aplicarCambios({ ...base, modoOscuro: true, altoContraste: true }, {});
    expect(r.modoOscuro && r.altoContraste).toBe(false);
  });
});

describe('modoActivo', () => {
  it('devuelve claro cuando no hay modo activo', () => {
    expect(modoActivo(base)).toBe('claro');
  });

  it('expone los dos modos excluyentes', () => {
    expect(MODOS_EXCLUYENTES).toEqual(['modoOscuro', 'altoContraste']);
  });
});
