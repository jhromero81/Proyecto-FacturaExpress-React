/**
 * useLocalStorage.js
 * Hook personalizado para sincronizar estado con localStorage.
 * Permite persistir datos entre sesiones con la interfaz de useState.
 */

import { useState, useCallback } from 'react';
import { storageGet, storageSet } from '../services/storageService';

/**
 * Hook que gestiona un valor persistido en localStorage.
 * @param {string} key - Clave de localStorage (sin prefijo).
 * @param {*} initialValue - Valor inicial si no existe en localStorage.
 * @returns {[*, function]} Tupla [valor, setter] similar a useState.
 */
const useLocalStorage = (key, initialValue) => {
  /** Estado interno inicializado desde localStorage */
  const [storedValue, setStoredValue] = useState(() => {
    return storageGet(key, initialValue);
  });

  /**
   * Actualiza el valor en estado y en localStorage.
   * Acepta un valor directo o una funcion actualizadora.
   * @param {*} value - Nuevo valor o funcion (prev) => newValue.
   */
  const setValue = useCallback((value) => {
    setStoredValue((prev) => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      storageSet(key, valueToStore);
      return valueToStore;
    });
  }, [key]);

  /** Elimina el valor de localStorage y restablece el valor inicial */
  const removeValue = useCallback(() => {
    storageSet(key, initialValue);
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
};

export default useLocalStorage;
