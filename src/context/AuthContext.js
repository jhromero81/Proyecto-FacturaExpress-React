/**
 * AuthContext.js
 * Contexto de autenticacion y accesibilidad de la aplicacion.
 * Proporciona estado global de sesion, tema visual y preferencias de usuario.
 */

import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import { storageGet, storageSet, clearSession } from '../services/storageService';

/** Crear el contexto de autenticacion */
const AuthContext = createContext(null);

/**
 * Proveedor de autenticacion que envuelve toda la aplicacion.
 * Gestiona sesion, tema oscuro, alto contraste, tamano de texto y usuario.
 */
export const AuthProvider = ({ children }) => {
  /** Estado de sesion activa */
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return storageGet('session_active', false);
  });

  /** Datos del usuario actual */
  const [user, setUser] = useState(() => {
    return storageGet('user_data', null);
  });

  /** Preferencias de accesibilidad */
  const [preferences, setPreferences] = useState(() => {
    return storageGet('prefs', {
      modoOscuro: false,
      altoContraste: false,
      tamanoTexto: 'medium',
    });
  });

  /** Momento en que se inicio la sesion */
  const [loginTime, setLoginTime] = useState(() => {
    return storageGet('login_time', null);
  });

  /** Aplicar las clases de accesibilidad al body cuando cambien las preferencias */
  useEffect(() => {
    const body = document.body;
    body.classList.toggle('fx-dark-mode', preferences.modoOscuro);
    body.classList.toggle('fx-high-contrast', preferences.altoContraste);

    // Aplicar tamano de fuente al elemento raiz
    const sizes = { small: '12px', medium: '15px', large: '18px' };
    document.documentElement.style.fontSize = sizes[preferences.tamanoTexto] || '15px';
  }, [preferences]);

  /**
   * Inicia sesion con las credenciales proporcionadas.
   * @param {string} nit - NIT o usuario.
   * @param {string} password - Contrasena.
   * @returns {boolean} true si las credenciales son validas.
   */
  const login = useCallback((nit, password) => {
    if (!nit || !password) return false;

    const now = new Date().toISOString();
    const userData = {
      id: 1,
      nombre: 'Jhon Henry Romero',
      rol: 'Administrador',
      email: 'admin@facturaexpress.co',
      nit,
    };

    storageSet('session_active', true);
    storageSet('login_time', now);
    storageSet('user_data', userData);

    setUser(userData);
    setLoginTime(now);
    setIsLoggedIn(true);
    return true;
  }, []);

  /** Cierra la sesion preservando preferencias de accesibilidad */
  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setLoginTime(null);
    setIsLoggedIn(false);
  }, []);

  /**
   * Actualiza las preferencias de accesibilidad.
   * @param {object} newPrefs - Nuevas preferencias a mezclar.
   */
  const updatePreferences = useCallback((newPrefs) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs };
      storageSet('prefs', updated);
      return updated;
    });
  }, []);

  /** Alterna el modo oscuro */
  const toggleDarkMode = useCallback(() => {
    setPreferences((prev) => {
      const updated = { ...prev, modoOscuro: !prev.modoOscuro };
      storageSet('prefs', updated);
      return updated;
    });
  }, []);

  /** Alterna el alto contraste */
  const toggleHighContrast = useCallback(() => {
    setPreferences((prev) => {
      const updated = { ...prev, altoContraste: !prev.altoContraste };
      storageSet('prefs', updated);
      return updated;
    });
  }, []);

  /** Establece el tamano del texto */
  const setTextSize = useCallback((size) => {
    updatePreferences({ tamanoTexto: size });
  }, [updatePreferences]);

  /** Valor del contexto memorizado */
  const value = useMemo(() => ({
    isLoggedIn,
    user,
    preferences,
    loginTime,
    login,
    logout,
    updatePreferences,
    toggleDarkMode,
    toggleHighContrast,
    setTextSize,
  }), [
    isLoggedIn, user, preferences, loginTime,
    login, logout, updatePreferences,
    toggleDarkMode, toggleHighContrast, setTextSize,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
