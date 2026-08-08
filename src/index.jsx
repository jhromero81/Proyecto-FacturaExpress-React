/**
 * index.js
 * Punto de entrada de la aplicacion FacturaExpress.
 * Renderiza el componente raiz dentro de React.StrictMode.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';

/** Obtener el elemento raiz del DOM */
const root = ReactDOM.createRoot(document.getElementById('root'));

/** Renderizar la aplicacion dentro de StrictMode para detectar problemas */
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
