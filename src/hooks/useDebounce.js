/**
 * useDebounce.js
 * Hook personalizado para retrasar la ejecucion de un valor.
 * Utilizado en busquedas para evitar consultas excesivas.
 */

import { useState, useEffect } from 'react';

/**
 * Hook que retorna una version "debounced" del valor proporcionado.
 * @param {*} value - Valor a debouncing.
 * @param {number} delay - Milisegundos de espera (default: 300ms).
 * @returns {*} Valor actualizado despues del delay.
 */
const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;
