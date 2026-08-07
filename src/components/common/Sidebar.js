/**
 * Sidebar.js
 * Componente de navegacion lateral izquierdo.
 * Contiene logo, enlaces de navegacion y boton de cerrar sesion.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';
import './Sidebar.css';

/** Items de navegacion del sidebar */
const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD,      icon: 'dashboard',            label: 'Panel Principal' },
  { to: ROUTES.VENTAS,         icon: 'shopping_cart',        label: 'Gestion de Ventas' },
  { to: ROUTES.FACTURACION,    icon: 'description',          label: 'Facturacion Electronica' },
  { to: ROUTES.CLIENTES,       icon: 'group',                label: 'Clientes' },
  { to: ROUTES.PRODUCTOS,      icon: 'inventory_2',          label: 'Inventario' },
  { to: ROUTES.REPORTES,       icon: 'bar_chart',            label: 'Reportes y Estadisticas' },
  { to: ROUTES.ERRORES,        icon: 'error_outline',        label: 'Errores del Sistema' },
  { to: ROUTES.AUDITORIA,      icon: 'fact_check',           label: 'Auditoria', adminOnly: true },
  { to: ROUTES.USUARIOS,       icon: 'admin_panel_settings', label: 'Usuarios', adminOnly: true },
  { to: ROUTES.BACKUP,         icon: 'backup',               label: 'Respaldos', adminOnly: true },
  { to: ROUTES.CONFIGURACION,  icon: 'settings',             label: 'Configuracion' },
];

/**
 * Componente Sidebar.
 * Renderiza la navegacion lateral fija con enlaces activos destacados.
 * @param {function} onLogout - Callback para abrir el modal de cerrar sesion.
 */
const Sidebar = ({ onLogout }) => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'admin';

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="sidebar">
      {/* Logo y nombre de la aplicacion */}
      <div className="sidebar-logo">
        <div className="logo-box">F</div>
        <span className="logo-text">FacturaExpress</span>
      </div>

      {/* Lista de navegacion */}
      <nav className="sidebar-nav">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            end={item.to === ROUTES.DASHBOARD}
          >
            <span className="material-icons">{item.icon}</span>
            <span className="link-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Seccion inferior con usuario y logout */}
      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <span className="material-icons user-avatar">account_circle</span>
            <div className="user-info">
              <span className="user-name">{user.nombre}</span>
              <span className="user-role">{user.rol}</span>
            </div>
          </div>
        )}
        <button className="sidebar-logout" onClick={onLogout}>
          <span className="material-icons">logout</span>
          <span>Cerrar Sesion</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
