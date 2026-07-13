/**
 * storageService.js
 * Servicio de persistencia de datos en localStorage.
 * Todas las claves se prefijan con 'facturaexpress_' para evitar colisiones.
 */

import { STORAGE_PREFIX } from '../utils/constants';

/**
 * Guarda un valor en localStorage serializandolo como JSON.
 * @param {string} key - Clave sin prefijo.
 * @param {*} value - Valor a almacenar.
 */
export const storageSet = (key, value) => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (error) {
    console.error(`Error al guardar ${key} en localStorage:`, error);
  }
};

/**
 * Obtiene un valor de localStorage parseandolo desde JSON.
 * @param {string} key - Clave sin prefijo.
 * @param {*} defaultValue - Valor por defecto si no existe la clave.
 * @returns {*} Valor almacenado o defaultValue.
 */
export const storageGet = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error al leer ${key} de localStorage:`, error);
    return defaultValue;
  }
};

/**
 * Elimina una clave especifica de localStorage.
 * @param {string} key - Clave sin prefijo.
 */
export const storageRemove = (key) => {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch (error) {
    console.error(`Error al eliminar ${key} de localStorage:`, error);
  }
};

/**
 * Limpia la sesion actual conservando preferencias de accesibilidad.
 */
export const clearSession = () => {
  try {
    // Preservar preferencias de accesibilidad
    const prefs = storageGet('prefs');
    const config = storageGet('config');

    // Limpiar todas las claves de la aplicacion
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Restaurar preferencias preservadas
    if (prefs) storageSet('prefs', prefs);
    if (config) storageSet('config', config);
  } catch (error) {
    console.error('Error al limpiar la sesion:', error);
  }
};

/**
 * Obtiene todos los elementos de una coleccion en localStorage.
 * @param {string} collectionKey - Clave de la coleccion.
 * @returns {Array} Array de elementos o array vacio.
 */
export const getCollection = (collectionKey) => {
  return storageGet(collectionKey, []);
};

/**
 * Agrega un elemento a una coleccion en localStorage.
 * @param {string} collectionKey - Clave de la coleccion.
 * @param {object} item - Elemento a agregar (se le asigna un id automatico).
 * @returns {object} Elemento agregado con id.
 */
export const addToCollection = (collectionKey, item) => {
  const collection = getCollection(collectionKey);
  const newItem = {
    ...item,
    id: Date.now(),
  };
  collection.unshift(newItem);
  storageSet(collectionKey, collection);
  return newItem;
};

/**
 * Actualiza un elemento de una coleccion por su id.
 * @param {string} collectionKey - Clave de la coleccion.
 * @param {number} id - Id del elemento a actualizar.
 * @param {object} updates - Campos a actualizar.
 * @returns {object|null} Elemento actualizado o null si no se encontro.
 */
export const updateInCollection = (collectionKey, id, updates) => {
  const collection = getCollection(collectionKey);
  const index = collection.findIndex((item) => item.id === id);
  if (index === -1) return null;
  collection[index] = { ...collection[index], ...updates };
  storageSet(collectionKey, collection);
  return collection[index];
};

/**
 * Elimina un elemento de una coleccion por su id.
 * @param {string} collectionKey - Clave de la coleccion.
 * @param {number} id - Id del elemento a eliminar.
 * @returns {boolean} true si se elimino, false si no se encontro.
 */
export const removeFromCollection = (collectionKey, id) => {
  const collection = getCollection(collectionKey);
  const filtered = collection.filter((item) => item.id !== id);
  if (filtered.length === collection.length) return false;
  storageSet(collectionKey, filtered);
  return true;
};
