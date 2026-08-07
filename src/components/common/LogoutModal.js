/**
 * LogoutModal.js
 * Modal de confirmacion para cerrar sesion.
 * Muestra informacion de la sesion actual y opciones de confirmacion.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';
import './LogoutModal.css';

/**
 * Componente LogoutModal.
 * @param {boolean} isOpen - Controla la visibilidad del modal.
 * @param {function} onClose - Callback para cerrar el modal.
 */
const LogoutModal = ({ isOpen, onClose }) => {
  const { user, loginTime, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const timerRef = useRef(null);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * Calcula la duracion de la sesion actual.
   * @returns {string} Texto con la duracion formateada.
   */
  const getSessionDuration = () => {
    if (!loginTime) return 'Desconocido';
    const diff = Date.now() - new Date(loginTime).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}min`;
    return `${minutes} min`;
  };

  /** Ejecuta el cierre de sesion con animacion de carga */
  const handleLogout = () => {
    setIsLoggingOut(true);
    timerRef.current = setTimeout(() => {
      logout();
      navigate(ROUTES.LOGIN);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado con gradiente oscuro */}
        <div className="logout-header">
          <span className="material-icons logout-header-icon">exit_to_app</span>
          <h3>Cerrar sesion?</h3>
        </div>

        {/* Cuerpo del modal */}
        <div className="logout-body">
          {/* Aviso de cambios sin guardar */}
          <div className="logout-warning">
            <span className="material-icons">warning</span>
            <span>Se cerrara tu sesion actual. Asegurate de haber guardado todos los cambios.</span>
          </div>

          {/* Informacion de la sesion */}
          <div className="logout-session-info">
            <div className="session-row">
              <span className="session-label">Usuario</span>
              <span className="session-value">{user?.nombre || 'N/A'}</span>
            </div>
            <div className="session-row">
              <span className="session-label">Rol</span>
              <span className="session-value">{user?.rol || 'N/A'}</span>
            </div>
            <div className="session-row">
              <span className="session-label">Sesion activa</span>
              <span className="session-value font-mono">{getSessionDuration()}</span>
            </div>
          </div>
        </div>

        {/* Pie con botones de accion */}
        <div className="logout-footer">
          <button className="btn-flat" onClick={onClose} disabled={isLoggingOut}>
            Cancelar
          </button>
          <button
            className="btn-danger-compact"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Cerrando...' : 'Salir Ahora'}
          </button>
        </div>

        {/* Overlay de carga durante el cierre */}
        {isLoggingOut && (
          <div className="logout-loading">
            <div className="logout-spinner" />
          </div>
        )}
      </div>
    </div>
  );
};

export default LogoutModal;
