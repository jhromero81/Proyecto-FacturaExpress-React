/**
 * TopBar.js
 * Barra superior fija que muestra titulo de pagina, estado DIAN
 * y controles de accesibilidad (modo oscuro, alto contraste).
 */

import React from 'react';
import useAuth from '../../hooks/useAuth';
import './TopBar.css';

/**
 * Componente TopBar.
 * @param {string} title - Titulo de la pagina actual.
 */
const TopBar = ({ title }) => {
  const { user, preferences, toggleDarkMode, toggleHighContrast } = useAuth();

  return (
    <header className="topbar">
      {/* Titulo de la pagina */}
      <h1 className="topbar-title font-mono">{title}</h1>

      {/* Indicador del modo de operacion: no hay integracion real con la DIAN */}
      <div
        className="topbar-dian"
        title="Los comprobantes son de demostracion: no se envian a la DIAN"
      >
        <span className="pulse-dot" />
        <span className="dian-text">MODO DEMOSTRACION</span>
      </div>

      {/* Controles de accesibilidad e informacion de usuario */}
      <div className="topbar-right">
        {/* Toggle modo oscuro */}
        <button
          type="button"
          className="topbar-icon-btn"
          onClick={toggleDarkMode}
          aria-pressed={preferences.modoOscuro}
          title={preferences.modoOscuro ? 'Desactivar modo oscuro' : 'Activar modo oscuro'}
        >
          <span className="material-icons">
            {preferences.modoOscuro ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* Toggle alto contraste */}
        <button
          type="button"
          className="topbar-icon-btn"
          onClick={toggleHighContrast}
          aria-pressed={preferences.altoContraste}
          title={
            preferences.altoContraste
              ? 'Desactivar alto contraste'
              : 'Activar alto contraste (desactiva el modo oscuro)'
          }
        >
          <span className="material-icons">contrast</span>
        </button>

        {/* Info del usuario */}
        {user && (
          <div className="topbar-user">
            <span className="topbar-user-name">{user.nombre}</span>
            <span className="material-icons topbar-user-icon">account_circle</span>
          </div>
        )}
      </div>
    </header>
  );
};

export default TopBar;
