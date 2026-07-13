/**
 * Footer.js
 * Pie de pagina global de la aplicacion.
 * Muestra copyright, indicadores de estado del sistema y anio actual.
 */

import React from 'react';
import './Footer.css';

/**
 * Componente Footer.
 * Se muestra en todas las paginas autenticadas.
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      {/* Copyright */}
      <div className="footer-left">
        <span>&copy; {currentYear} FACTURAEXPRESS &mdash; FACTURACION SEGURA</span>
      </div>

      {/* Indicadores de estado del sistema */}
      <div className="footer-right">
        <div className="footer-status">
          <span className="pulse-dot" />
          <span>MOTOR FISCAL ACTIVO</span>
        </div>
        <div className="footer-status">
          <span className="pulse-dot" />
          <span>BACKUPS AL DIA</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
