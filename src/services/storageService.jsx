/**
 * storageService.jsx
 * Servicio unificado para persistencia de datos.
 * Usa localStorage para preferencias y React Query para datos de API.
 */

import { useQuery } from '@tanstack/react-query';

/**
 * Obtiene una preferencia guardada en localStorage.
 * @param {string} key - Clave del almacenamiento.
 * @param {*} defaultValue - Valor por defecto si no existe.
 * @returns {*} La preferencia guardada.
 */
export const storageGet = (key, defaultValue) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error al leer de localStorage:', error);
    return defaultValue;
  }
};

/**
 * Guarda una preferencia en localStorage.
 * @param {string} key - Clave del almacenamiento.
 * @param {*} value - Valor a guardar.
 */
export const storageSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error al escribir en localStorage:', error);
  }
};

/**
 * Limpia la sesión local.
 */
export const clearSession = () => {
  storageSet('session_active', false);
  storageSet('login_time', null);
  storageSet('user_data', null);
  storageSet('prefs', { modoOscuro: false, altoContraste: false, tamanoTexto: 'medium' });
};

/**
 * Hook para obtener datos de la API con caché.
 * Reemplaza el uso directo de fetch en páginas.
 * @param {string} queryKey - Clave única para el cacheo.
 * @param {object} queryFn - Función que devuelve los datos.
 */
export const useCachedQuery = (queryKey, queryFn) => {
  return useQuery({
    queryKey: [queryKey],
    queryFn: () => queryFn(),
  });
};
