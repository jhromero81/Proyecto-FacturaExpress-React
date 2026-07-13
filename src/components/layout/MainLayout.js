/**
 * MainLayout.js
 * Layout principal para paginas autenticadas.
 * Compone el Sidebar, TopBar, Footer y el area de contenido principal.
 */

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import TopBar from '../common/TopBar';
import Footer from '../common/Footer';
import LogoutModal from '../common/LogoutModal';

/**
 * Componente MainLayout.
 * Se utiliza como ruta padre para todas las paginas protegidas.
 * Renderiza la estructura base: sidebar + topbar + contenido + footer.
 */
const MainLayout = () => {
  /** Control de visibilidad del modal de logout */
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  return (
    <div className="main-layout">
      {/* Barra lateral de navegacion */}
      <Sidebar onLogout={() => setShowLogoutModal(true)} />

      {/* Contenedor del contenido principal */}
      <div className="app-layout">
        {/* Barra superior */}
        <TopBar title="FacturaExpress" />

        {/* Area de contenido - renderiza la ruta hijo */}
        <main className="main-content">
          <Outlet />
        </main>

        {/* Pie de pagina */}
        <Footer />
      </div>

      {/* Modal de confirmacion de cierre de sesion */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
      />
    </div>
  );
};

export default MainLayout;
