/**
 * AuthContext.js
 * Contexto de autenticacion y accesibilidad de la aplicacion.
 * Proporciona estado global de sesion, tema visual y preferencias de usuario.
 */

import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import { storageGet, storageSet, clearSession } from '../services/storageService';
import { login as apiLogin, setAuthToken } from '../services/api';
import { PERFILES_USUARIO } from '../utils/constants';

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

  /** Token JWT de la sesion */
  const [token, setToken] = useState(() => {
    return storageGet('auth_token', null);
  });

  /** Mantener el token sincronizado con el cliente HTTP */
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

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
   * Valida contra la API REST y almacena el token JWT.
   * @param {string} nit - NIT o usuario.
   * @param {string} password - Contrasena.
   * @returns {Promise<object>} Respuesta de la API ({ token, usuario }).
   * @throws {Error} Si las credenciales son invalidas o hay error de red.
   */
  const login = useCallback(async (nit, password) => {
    const result = await apiLogin(nit, password);

    // Mapear el rol del backend a su nombre descriptivo
    const perfil = PERFILES_USUARIO[result.usuario.rol];
    const userData = {
      ...result.usuario,
      rol: perfil ? perfil.nombre : result.usuario.rol,
    };

    const now = new Date().toISOString();

    storageSet('session_active', true);
    storageSet('login_time', now);
    storageSet('user_data', userData);
    storageSet('auth_token', result.token);

    setToken(result.token);
    setUser(userData);
    setLoginTime(now);
    setIsLoggedIn(true);
    return result;
  }, []);

  /** Cierra la sesion preservando preferencias de accesibilidad */
  const logout = useCallback(() => {
    clearSession();
    setToken(null);
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
    token,
    preferences,
    loginTime,
    login,
    logout,
    updatePreferences,
    toggleDarkMode,
    toggleHighContrast,
    setTextSize,
  }), [
    isLoggedIn, user, token, preferences, loginTime,
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
