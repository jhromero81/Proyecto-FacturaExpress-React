/**
 * Configuracion.js
 * Modulo de configuracion del sistema.
 * Permite gestionar datos de la empresa, configuracion fiscal DIAN,
 * perfiles de usuario, notificaciones, seguridad y accesibilidad.
 * Es el modulo mas extenso del sistema con 6 secciones.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import useAuth from '../hooks/useAuth';
import { useToast } from '../components/common/Toast';
import {
  storageGet,
  storageSet,
} from '../services/storageService';
import { EMPRESA_DEFAULT } from '../utils/constants';
import './Configuracion.css';

/**
 * Configuracion del sistema con valores por defecto.
 */
const defaultConfig = {
  empresa: EMPRESA_DEFAULT,
  fiscal: {
    resolucionDIAN: 'RES-2024-001234',
    fechaExpiracionCert: '2026-12-31',
    ultimaSync: new Date().toISOString(),
  },
  notificaciones: {
    email: true,
    push: true,
    dianAlerts: true,
    recordatorios: false,
  },
  seguridad: {
    ultimoCambioPass: '2026-01-15',
    dispositivosConectados: 3,
    ultimaIP: '192.168.1.105',
  },
};

/**
 * Componente Configuracion.
 * Panel de configuracion con multiples secciones colapsables.
 */
const Configuracion = () => {
  const { preferences, toggleDarkMode, toggleHighContrast, setTextSize } = useAuth();
  const { showToast } = useToast();

  /** Configuracion cargada */
  const [config, setConfig] = useState(() => {
    return storageGet('config', defaultConfig);
  });

  /** Seccion activa (para tabs) */
  const [activeSection, setActiveSection] = useState('empresa');

  /** Estado de carga para operaciones simuladas */
  const [syncing, setSyncing] = useState(false);

  /** Referencia para limpiar timeout al desmontar */
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * Actualiza un campo de la configuracion y persiste en localStorage.
   */
  const updateConfig = useCallback(
    (section, field, value) => {
      setConfig((prev) => {
        const updated = {
          ...prev,
          [section]: {
            ...prev[section],
            [field]: value,
          },
        };
        storageSet('config', updated);
        return updated;
      });
    },
    []
  );

  /** Guarda la configuracion de la empresa */
  const saveEmpresa = useCallback(() => {
    storageSet('config', config);
    showToast('Datos de la empresa guardados', 'success');
  }, [config, showToast]);

  /** Simula una sincronizacion con la DIAN */
  const syncDIAN = useCallback(() => {
    setSyncing(true);
    timerRef.current = setTimeout(() => {
      updateConfig('fiscal', 'ultimaSync', new Date().toISOString());
      setSyncing(false);
      showToast('Sincronizacion con DIAN completada', 'success');
    }, 2000);
  }, [showToast, updateConfig]);

  /**
   * Lista de secciones de configuracion.
   */
  const sections = [
    { key: 'empresa', label: 'Datos de la Empresa', icon: 'business' },
    { key: 'fiscal', label: 'Configuracion Fiscal (DIAN)', icon: 'verified' },
    { key: 'usuarios', label: 'Perfiles de Usuario', icon: 'admin_panel_settings' },
    { key: 'notificaciones', label: 'Notificaciones', icon: 'notifications' },
    { key: 'seguridad', label: 'Seguridad', icon: 'shield' },
    { key: 'accesibilidad', label: 'Accesibilidad', icon: 'accessibility_new' },
  ];

  return (
    <div className="configuracion-page">
      {/* Navegacion por secciones */}
      <div className="config-nav">
        {sections.map((s) => (
          <button
            key={s.key}
            className={`config-nav-item ${activeSection === s.key ? 'active' : ''}`}
            onClick={() => setActiveSection(s.key)}
          >
            <span className="material-icons">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido de la seccion activa */}
      <div className="config-content">
        {/* ============================
            SECCION: DATOS DE LA EMPRESA
            ============================ */}
        {activeSection === 'empresa' && (
          <div className="config-section-card">
            <h3 className="config-title">
              <span className="material-icons">business</span>
              Datos de la Empresa
            </h3>
            <div className="config-form">
              <div className="form-group">
                <label>NIT</label>
                <input
                  type="text"
                  value={config.empresa.nit}
                  onChange={(e) => updateConfig('empresa', 'nit', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Razon Social</label>
                <input
                  type="text"
                  value={config.empresa.razonSocial}
                  onChange={(e) =>
                    updateConfig('empresa', 'razonSocial', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>Email de Facturacion</label>
                <input
                  type="email"
                  value={config.empresa.emailFacturacion}
                  onChange={(e) =>
                    updateConfig('empresa', 'emailFacturacion', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>Telefono</label>
                <input
                  type="tel"
                  value={config.empresa.telefono}
                  onChange={(e) =>
                    updateConfig('empresa', 'telefono', e.target.value)
                  }
                />
              </div>
              <div className="config-actions">
                <button className="btn-teal" onClick={saveEmpresa}>
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================
            SECCION: CONFIGURACION FISCAL
            ============================ */}
        {activeSection === 'fiscal' && (
          <div className="config-section-card">
            <h3 className="config-title">
              <span className="material-icons">verified</span>
              Configuracion Fiscal (DIAN)
            </h3>
            <div className="config-form">
              <div className="form-group">
                <label>Numero de Resolucion DIAN</label>
                <input
                  type="text"
                  value={config.fiscal.resolucionDIAN}
                  readOnly
                />
              </div>
              <div className="form-group">
                <label>Fecha Expiracion Certificado</label>
                <div className="config-badge-row">
                  <input
                    type="text"
                    value={config.fiscal.fechaExpiracionCert}
                    readOnly
                  />
                  <span className="expiry-badge">
                    Vigente hasta {config.fiscal.fechaExpiracionCert}
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label>Ultima Sincronizacion</label>
                <input
                  type="text"
                  value={new Date(config.fiscal.ultimaSync).toLocaleString('es-CO')}
                  readOnly
                />
              </div>
              <div className="config-actions">
                <button
                  className="btn-teal"
                  onClick={syncDIAN}
                  disabled={syncing}
                >
                  {syncing ? 'Sincronizando...' : 'Sincronizar con DIAN'}
                </button>
                <button className="btn-outline-accent">
                  Subir Certificado
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================
            SECCION: PERFILES DE USUARIO
            ============================ */}
        {activeSection === 'usuarios' && (
          <div className="config-section-card">
            <h3 className="config-title">
              <span className="material-icons">admin_panel_settings</span>
              Perfiles de Usuario
            </h3>
            <div className="roles-grid">
              {/* Rol Administradores */}
              <div className="role-card">
                <span className="material-icons role-icon">admin_panel_settings</span>
                <h4>Administradores</h4>
                <p>Acceso total al sistema</p>
                <button className="btn-flat">Gestionar</button>
              </div>
              {/* Rol Vendedores */}
              <div className="role-card">
                <span className="material-icons role-icon">point_of_sale</span>
                <h4>Vendedores</h4>
                <p>Gestion de ventas y clientes</p>
                <button className="btn-flat">Gestionar</button>
              </div>
              {/* Rol Contadores */}
              <div className="role-card">
                <span className="material-icons role-icon">analytics</span>
                <h4>Contadores / Reportes</h4>
                <p>Solo lectura y reportes</p>
                <button className="btn-flat">Gestionar</button>
              </div>
            </div>
            <div className="config-actions" style={{ marginTop: '20px' }}>
              <button className="btn-outline-accent">
                <span className="material-icons">person_add</span>
                Gestionar Usuarios
              </button>
              <button className="btn-outline-accent">
                <span className="material-icons">history</span>
                Ver Actividad Reciente
              </button>
            </div>
          </div>
        )}

        {/* ============================
            SECCION: NOTIFICACIONES
            ============================ */}
        {activeSection === 'notificaciones' && (
          <div className="config-section-card">
            <h3 className="config-title">
              <span className="material-icons">notifications</span>
              Notificaciones
            </h3>
            <div className="config-form">
              {/* Toggle: Email */}
              <div className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Notificaciones por Email</span>
                  <span className="toggle-desc">
                    Recibir alertas de facturacion por correo
                  </span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={config.notificaciones.email}
                    onChange={(e) =>
                      updateConfig('notificaciones', 'email', e.target.checked)
                    }
                  />
                  <span className="lever" />
                </label>
              </div>

              {/* Toggle: Push */}
              <div className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Notificaciones Push</span>
                  <span className="toggle-desc">
                    Alertas en tiempo real en el navegador
                  </span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={config.notificaciones.push}
                    onChange={(e) =>
                      updateConfig('notificaciones', 'push', e.target.checked)
                    }
                  />
                  <span className="lever" />
                </label>
              </div>

              {/* Toggle: DIAN */}
              <div className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Alertas de Facturacion DIAN</span>
                  <span className="toggle-desc">
                    Notificaciones sobre estado de facturas ante la DIAN
                  </span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={config.notificaciones.dianAlerts}
                    onChange={(e) =>
                      updateConfig('notificaciones', 'dianAlerts', e.target.checked)
                    }
                  />
                  <span className="lever" />
                </label>
              </div>

              {/* Toggle: Recordatorios */}
              <div className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Recordatorios Automaticos</span>
                  <span className="toggle-desc">
                    Recordar pendientes de facturacion
                  </span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={config.notificaciones.recordatorios}
                    onChange={(e) =>
                      updateConfig(
                        'notificaciones',
                        'recordatorios',
                        e.target.checked
                      )
                    }
                  />
                  <span className="lever" />
                </label>
              </div>

              <div className="config-actions">
                <button
                  className="btn-teal"
                  onClick={() => {
                    storageSet('config', config);
                    showToast('Preferencias de notificacion guardadas', 'success');
                  }}
                >
                  Guardar Preferencias
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================
            SECCION: SEGURIDAD
            ============================ */}
        {activeSection === 'seguridad' && (
          <div className="config-section-card">
            <h3 className="config-title">
              <span className="material-icons">shield</span>
              Seguridad
            </h3>
            <div className="config-form">
              {/* Info de seguridad */}
              <div className="security-info-grid">
                <div className="security-item">
                  <span className="material-icons">lock</span>
                  <div>
                    <span className="security-label">Ultimo cambio de contrasena</span>
                    <span className="security-value font-mono">
                      {config.seguridad.ultimoCambioPass}
                    </span>
                  </div>
                </div>
                <div className="security-item">
                  <span className="material-icons">devices</span>
                  <div>
                    <span className="security-label">Dispositivos conectados</span>
                    <span className="security-value font-mono">
                      {config.seguridad.dispositivosConectados}
                    </span>
                  </div>
                </div>
                <div className="security-item">
                  <span className="material-icons">wifi</span>
                  <div>
                    <span className="security-label">Ultima IP de acceso</span>
                    <span className="security-value font-mono">
                      {config.seguridad.ultimaIP}
                    </span>
                  </div>
                </div>
              </div>

              <div className="config-actions">
                <button
                  className="btn-outline-accent"
                  onClick={() => showToast('Cambio de contrasena en desarrollo', 'info')}
                >
                  <span className="material-icons">lock_reset</span>
                  Cambiar Contrasena
                </button>
                <button
                  className="btn-outline-accent"
                  onClick={() => showToast('Autenticacion 2FA en desarrollo', 'info')}
                >
                  <span className="material-icons">security</span>
                  Autenticacion 2FA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================
            SECCION: ACCESIBILIDAD
            ============================ */}
        {activeSection === 'accesibilidad' && (
          <div className="config-section-card">
            <h3 className="config-title">
              <span className="material-icons">accessibility_new</span>
              Accesibilidad
            </h3>
            <div className="config-form">
              {/* Toggle: Alto contraste */}
              <div className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Alto Contraste</span>
                  <span className="toggle-desc">
                    Colores de alto contraste para mejor visibilidad
                  </span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={preferences.altoContraste}
                    onChange={toggleHighContrast}
                  />
                  <span className="lever" />
                </label>
              </div>

              {/* Toggle: Modo oscuro */}
              <div className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Modo Oscuro</span>
                  <span className="toggle-desc">
                    Tema oscuro para reducir fatiga visual
                  </span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={preferences.modoOscuro}
                    onChange={toggleDarkMode}
                  />
                  <span className="lever" />
                </label>
              </div>

              {/* Tamano de texto */}
              <div className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Tamano del Texto</span>
                  <span className="toggle-desc">
                    Ajustar el tamano de fuente general
                  </span>
                </div>
                <div className="size-options">
                  {[
                    { key: 'small', label: 'S' },
                    { key: 'medium', label: 'M' },
                    { key: 'large', label: 'L' },
                  ].map((size) => (
                    <button
                      key={size.key}
                      className={`size-badge ${
                        preferences.tamanoTexto === size.key ? 'active' : ''
                      }`}
                      onClick={() => setTextSize(size.key)}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Configuracion;
