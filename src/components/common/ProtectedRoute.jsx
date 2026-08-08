/**
 * ProtectedRoute.js
 * Componente de ruta protegida.
 * Redirige al login si el usuario no esta autenticado.
 * Redirige al dashboard si ya esta autenticado y accede al login.
 */

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';

/**
 * Ruta que requiere autenticacion.
 * Si el usuario no esta logueado, redirige al login.
 * Si esta logueado y accede al login, redirige al dashboard.
 */
export const ProtectedRoute = () => {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
};

/**
 * Ruta publica (solo para no autenticados).
 * Si el usuario ya esta logueado, redirige al dashboard.
 */
export const PublicRoute = () => {
  const { isLoggedIn } = useAuth();

  if (isLoggedIn) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
