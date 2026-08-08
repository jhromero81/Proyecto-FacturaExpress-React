/**
 * Login.js
 * Pagina de inicio de sesion de FacturaExpress.
 * Presenta formulario de acceso con credenciales, toggle de accesibilidad
 * y efectos visuales decorativos (gradientes radiales).
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { ROUTES } from '../utils/constants';
import './Login.css';

/**
 * Componente Login.
 * Formulario de autenticacion contra la API REST de FacturaExpress.
 */
const Login = () => {
  const navigate = useNavigate();
  const { login, preferences, toggleDarkMode, toggleHighContrast } = useAuth();

  /** Estado del campo NIT/usuario */
  const [nit, setNit] = useState('');

  /** Estado del campo contrasena */
  const [password, setPassword] = useState('');

  /** Indicador de visibilidad de la contrasena */
  const [showPassword, setShowPassword] = useState(false);

  /** Mensaje de error para mostrar en la UI */
  const [error, setError] = useState('');

  /** Estado de carga durante el proceso de login */
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Maneja el envio del formulario de login.
   * Valida campos, autentica contra la API y redirige al dashboard.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validar campos vacios
    if (!nit.trim() || !password.trim()) {
      setError('Por favor complete todos los campos.');
      return;
    }

    setIsLoading(true);

    try {
      await login(nit.trim(), password);
      navigate(ROUTES.DASHBOARD);
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas.');
      setIsLoading(false);
    }
  };

  /**
   * Permite enviar el formulario con la tecla Enter.
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="login-page">
      {/* Elementos decorativos de fondo (gradientes radiales) */}
      <div className="login-bg-blob blob-1" />
      <div className="login-bg-blob blob-2" />

      {/* Tarjeta principal de login */}
      <div className="login-card">
        {/* Botones de accesibilidad (antes del login) */}
        <div className="login-accessibility">
          <button
            className="acc-btn"
            onClick={toggleDarkMode}
            title={preferences.modoOscuro ? 'Modo claro' : 'Modo oscuro'}
          >
            <span className="material-icons">
              {preferences.modoOscuro ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <button
            className="acc-btn"
            onClick={toggleHighContrast}
            title={preferences.altoContraste ? 'Contraste normal' : 'Alto contraste'}
          >
            <span className="material-icons">contrast</span>
          </button>
        </div>

        {/* Logo y titulo */}
        <div className="login-header">
          <div className="login-logo">F</div>
          <h1 className="login-title">FacturaExpress</h1>
          <p className="login-subtitle">Sistema de Facturacion Electronica DIAN</p>
          <div className="login-dian-badge">
            <span className="pulse-dot" />
            <span>DIAN Conectado</span>
          </div>
        </div>

        {/* Formulario de credenciales */}
        <div className="login-form">
          {/* Campo NIT / Usuario */}
          <div className="login-field">
            <span className="material-icons field-icon">business</span>
            <input
              type="text"
              placeholder="NIT o Usuario"
              value={nit}
              onChange={(e) => setNit(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              autoFocus
            />
          </div>

          {/* Campo Contrasena */}
          <div className="login-field">
            <span className="material-icons field-icon">lock</span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Contrasena"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              <span className="material-icons">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>

          {/* Mensaje de error */}
          {error && <div className="login-error">{error}</div>}

          {/* Boton de iniciar sesion */}
          <button
            className="login-btn"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="login-btn-loading">
                <span className="spinner" />
                Ingresando...
              </span>
            ) : (
              'Iniciar Sesion'
            )}
          </button>
        </div>

        {/* Links auxiliares */}
        <div className="login-links">
          <a href="#recuperar" onClick={(e) => e.preventDefault()}>
            Recuperar acceso
          </a>
          <a href="#admin" onClick={(e) => e.preventDefault()}>
            Contacte al administrador
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
