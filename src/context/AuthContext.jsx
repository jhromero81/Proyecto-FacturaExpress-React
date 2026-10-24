/**
 * AuthContext.jsx
 * Contexto de autenticacion y accesibilidad de la aplicacion.
 * Proporciona estado global de sesion, tema visual y preferencias de usuario.
 * La sesion se mantiene en una cookie httpOnly del servidor (anti-XSS):
 * el frontend no almacena el token JWT en localStorage.
 */

import React, { createContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { storageGet, storageSet, clearSession } from '../services/storageService';
import { login as apiLogin, logout as apiLogout, getMe } from '../services/api';
import { PERFILES_USUARIO } from '../utils/constants';
import { alternarModo, aplicarCambios, normalizarPreferencias } from '../utils/preferences';

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
    const guardadas = storageGet('prefs', {
      modoOscuro: false,
      altoContraste: false,
      tamanoTexto: 'medium',
    });
    // Una version anterior permitia tener los dos modos activos a la vez
    const normalizadas = normalizarPreferencias(guardadas);
    if (normalizadas !== guardadas) storageSet('prefs', normalizadas);
    return normalizadas;
  });

  /** Momento en que se inicio la sesion */
  const [loginTime, setLoginTime] = useState(() => {
    return storageGet('login_time', null);
  });

  /** Evita validar la sesion mas de una vez por montaje */
  const sessionChecked = useRef(false);

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
   * Restaura la sesion al recargar la pagina.
   * La cookie httpOnly conserva la sesion en el servidor; se valida
   * con GET /auth/me y se refrescan los datos del usuario.
   */
  useEffect(() => {
    if (sessionChecked.current) return;
    sessionChecked.current = true;

    const restaurarSesion = async () => {
      try {
        const result = await getMe();
        const perfil = PERFILES_USUARIO[result.usuario.rol?.toUpperCase()];
        setUser({
          ...result.usuario,
          // rol: valor tecnico ('admin') para comparaciones de permisos;
          // rolNombre: etiqueta legible para la interfaz (como en Angular)
          rol: perfil ? perfil.rol : result.usuario.rol,
          rolNombre: perfil ? perfil.nombre : result.usuario.rol,
        });
        setIsLoggedIn(true);
      } catch (error) {
        clearSession();
        setIsLoggedIn(false);
        setUser(null);
        setLoginTime(null);
      }
    };

    if (storageGet('session_active', false)) {
      restaurarSesion();
    }
  }, []);

  /**
   * Inicia sesion con las credenciales proporcionadas.
   * El servidor establece la cookie httpOnly de sesion.
   * @param {string} nit - NIT o usuario.
   * @param {string} password - Contrasena.
   * @returns {Promise<object>} Respuesta de la API ({ token, usuario }).
   * @throws {Error} Si las credenciales son invalidas o hay error de red.
   */
  const login = useCallback(async (nit, password) => {
    const result = await apiLogin(nit, password);

    // Mapear el rol del backend a su nombre descriptivo
    const perfil = PERFILES_USUARIO[result.usuario.rol?.toUpperCase()];
    const userData = {
      ...result.usuario,
      // rol tecnico para permisos + etiqueta legible para la interfaz
      rol: perfil ? perfil.rol : result.usuario.rol,
      rolNombre: perfil ? perfil.nombre : result.usuario.rol,
    };

    const now = new Date().toISOString();

    storageSet('session_active', true);
    storageSet('login_time', now);
    storageSet('user_data', userData);

    setUser(userData);
    setLoginTime(now);
    setIsLoggedIn(true);
    return result;
  }, []);

  /** Cierra la sesion: invalida la cookie en el servidor y limpia el estado local */
  const logout = useCallback(() => {
    apiLogout().catch(() => { /* la sesion local se limpia igualmente */ });
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
      const updated = aplicarCambios(prev, newPrefs);
      storageSet('prefs', updated);
      return updated;
    });
  }, []);

  /**
   * Alterna el modo oscuro.
   * Encenderlo apaga el alto contraste: los dos modos definen la paleta
   * completa y combinados mezclan tokens de ambos (texto claro del oscuro
   * sobre el fondo blanco del alto contraste, bordes negros sobre negro).
   */
  const toggleDarkMode = useCallback(() => {
    setPreferences((prev) => {
      const updated = alternarModo(prev, 'modoOscuro');
      storageSet('prefs', updated);
      return updated;
    });
  }, []);

  /** Alterna el alto contraste. Encenderlo apaga el modo oscuro. */
  const toggleHighContrast = useCallback(() => {
    setPreferences((prev) => {
      const updated = alternarModo(prev, 'altoContraste');
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
