/**
 * App.js
 * Componente raiz de FacturaExpress.
 * Configura el enrutamiento global, proveedores de contexto y
 * define las rutas publicas y protegidas de la aplicacion.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { ProtectedRoute, PublicRoute } from './components/common/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';

// Paginas
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Ventas from './pages/Ventas';
import Facturacion from './pages/Facturacion';
import Clientes from './pages/Clientes';
import Reportes from './pages/Reportes';
import Configuracion from './pages/Configuracion';

import { ROUTES } from './utils/constants';

/**
 * Componente raiz de la aplicacion.
 * Enruta todas las vistas y envuelve la app en los proveedores necesarios.
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Ruta de login (solo accesible si NO esta autenticado) */}
            <Route element={<PublicRoute />}>
              <Route path={ROUTES.LOGIN} element={<Login />} />
            </Route>

            {/* Rutas protegidas (requieren autenticacion) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
                <Route path={ROUTES.VENTAS} element={<Ventas />} />
                <Route path={ROUTES.FACTURACION} element={<Facturacion />} />
                <Route path={ROUTES.CLIENTES} element={<Clientes />} />
                <Route path={ROUTES.REPORTES} element={<Reportes />} />
                <Route path={ROUTES.CONFIGURACION} element={<Configuracion />} />
              </Route>
            </Route>

            {/* Redireccionar rutas no encontradas al dashboard */}
            <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
