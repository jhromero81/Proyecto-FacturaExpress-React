/**
 * Toast.js
 * Sistema de notificaciones emergentes (toast).
 * Muestra mensajes temporales de exito, error, info o advertencia.
 */

import React, { useState, useCallback, useEffect, useRef, createContext, useContext } from 'react';

/** Contexto para comunicar el sistema toast a cualquier componente */
const ToastContext = createContext(null);

/**
 * Hook para acceder al sistema de toast desde cualquier componente.
 * @returns {{ showToast: function }}
 */
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro del provider de Toast');
  return ctx;
};

/**
 * Proveedor del sistema toast.
 * Debe envolver la parte de la app que requiere notificaciones.
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef([]);

  // Limpiar todos los timers al desmontar el provider
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  /**
   * Muestra un toast con los parametros indicados.
   * @param {string} message - Mensaje a mostrar.
   * @param {string} type - Tipo: 'success' | 'error' | 'info' | 'warning'.
   * @param {number} duration - Duracion en milisegundos (default: 3000).
   */
  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current = timersRef.current.filter((t) => t !== timer);
    }, duration);
    timersRef.current.push(timer);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Contenedor de toasts visibles */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/**
 * Componente Toast (renderizado por el provider).
 * Se mantiene por compatibilidad pero el renderizado real
 * esta integrado en el ToastProvider.
 */
const Toast = () => null;

export default Toast;
