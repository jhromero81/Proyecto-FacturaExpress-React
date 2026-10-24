/**
 * utils/preferences.js
 * Reglas de los modos de visualizacion (claro, oscuro y alto contraste).
 *
 * El modo oscuro y el modo de alto contraste son excluyentes: cada uno
 * define la paleta completa en el CSS global, y aplicarlos a la vez mezcla
 * tokens de los dos (texto claro del modo oscuro sobre el fondo blanco del
 * alto contraste, bordes negros sobre negro...). Por eso ninguna transicion
 * puede dejar los dos activos: este modulo es el unico que decide el estado.
 */

/** Modos que se excluyen entre si. */
export const MODOS_EXCLUYENTES = ['modoOscuro', 'altoContraste'];

/**
 * Corrige un estado de preferencias que tenga los dos modos activos.
 * Se conserva el alto contraste, que es el modo de accesibilidad, y se apaga
 * el oscuro. Devuelve el mismo objeto si no hay nada que corregir, para no
 * provocar renders ni escrituras innecesarias.
 *
 * @param {object} prefs - Preferencias guardadas o en curso.
 * @returns {object} Preferencias validas.
 */
export const normalizarPreferencias = (prefs) =>
  prefs.modoOscuro && prefs.altoContraste ? { ...prefs, modoOscuro: false } : prefs;

/**
 * Aplica un cambio parcial de preferencias respetando la exclusividad:
 * si el cambio enciende un modo, apaga el otro. Es el camino que deben usar
 * todos los puntos de la interfaz (topbar, login y configuracion) para que
 * la regla no dependa de cual boton se pulso.
 *
 * @param {object} prefs - Preferencias actuales.
 * @param {object} cambios - Cambios parciales.
 * @returns {object} Preferencias nuevas.
 */
export const aplicarCambios = (prefs, cambios) => {
  const siguiente = { ...prefs, ...cambios };
  if (cambios.modoOscuro === true) siguiente.altoContraste = false;
  if (cambios.altoContraste === true) siguiente.modoOscuro = false;
  return normalizarPreferencias(siguiente);
};

/**
 * Alterna un modo de visualizacion.
 * - Si estaba apagado, se enciende y apaga el otro modo.
 * - Si estaba encendido, se apaga y el otro queda como estaba (apagado).
 *
 * @param {object} prefs - Preferencias actuales.
 * @param {'modoOscuro'|'altoContraste'} modo - Modo que se pulsa.
 * @returns {object} Preferencias nuevas.
 */
export const alternarModo = (prefs, modo) => {
  if (!MODOS_EXCLUYENTES.includes(modo)) {
    throw new Error(`Modo de visualizacion desconocido: ${modo}`);
  }

  return aplicarCambios(prefs, { [modo]: !prefs[modo] });
};

/** Modo activo ('claro' cuando ninguno lo esta). Util para etiquetas y pruebas. */
export const modoActivo = (prefs) => {
  if (prefs.altoContraste) return 'altoContraste';
  if (prefs.modoOscuro) return 'modoOscuro';
  return 'claro';
};
