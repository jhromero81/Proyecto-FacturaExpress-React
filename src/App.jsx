/**
 * App.jsx
 * Componente raíz de FacturaExpress.
 * Configura el enrutamiento global, proveedores de contexto y
 * define las rutas públicas y protegidas de la aplicación.
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from './context/QueryClient';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { ProtectedRoute, PublicRoute } from './components/common/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import useAuth from './hooks/useAuth';

// Páginas cargadas bajo demanda: cada ruta es su propio chunk, así el
// login no arrastra el código de los once módulos restantes.
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Ventas = lazy(() => import('./pages/Ventas'));
const Facturacion = lazy(() => import('./pages/Facturacion'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Productos = lazy(() => import('./pages/Productos'));
const Reportes = lazy(() => import('./pages/Reportes'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Errores = lazy(() => import('./pages/Errores'));
const Auditoria = lazy(() => import('./pages/Auditoria'));
const Backup = lazy(() => import('./pages/Backup'));
const Configuracion = lazy(() => import('./pages/Configuracion'));

import { ROUTES } from './utils/constants';

/**
 * Marcador de carga para los chunks de ruta.
 * Usa los tokens del sistema de diseño para no romper la apariencia.
 */
const PageLoader = () => (
  <div
    role="status"
    aria-live="polite"
    style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}
  >
    Cargando...
  </div>
);

/**
 * Ruta protegida exclusiva para administradores.
 * Redirige al panel principal si el usuario no tiene rol administrador.
 */
const AdminRoute = () => {
  const { user } = useAuth();
  return user?.rol === 'admin' ? <Outlet /> : <Navigate to={ROUTES.DASHBOARD} replace />;
};

/**
 * Componente raíz de la aplicación.
 * Enruta todas las vistas y envuelve la app en los proveedores necesarios.
 */
function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* Ruta de login (solo accesible si NO está autenticado) */}
              <Route element={<PublicRoute />}>
                <Route path={ROUTES.LOGIN} element={<Login />} />
              </Route>

              {/* Rutas protegidas (requieren autenticación) */}
              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
                  <Route path={ROUTES.VENTAS} element={<Ventas />} />
                  <Route path={ROUTES.FACTURACION} element={<Facturacion />} />
                  <Route path={ROUTES.CLIENTES} element={<Clientes />} />
                  <Route path={ROUTES.PRODUCTOS} element={<Productos />} />
                  <Route path={ROUTES.REPORTES} element={<Reportes />} />
                  <Route path={ROUTES.ERRORES} element={<Errores />} />
                  <Route path={ROUTES.CONFIGURACION} element={<Configuracion />} />

                  {/* Rutas exclusivas para administradores */}
                  <Route element={<AdminRoute />}>
                    <Route path={ROUTES.USUARIOS} element={<Usuarios />} />
                    <Route path={ROUTES.AUDITORIA} element={<Auditoria />} />
                    <Route path={ROUTES.BACKUP} element={<Backup />} />
                  </Route>
                </Route>
              </Route>

              {/* Redireccionar rutas no encontradas al dashboard */}
              <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
