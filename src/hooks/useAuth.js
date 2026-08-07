/**
 * useAuth.js
 * Hook personalizado para acceder al contexto de autenticacion.
 * Simplifica el consumo del AuthContext en componentes funcionales.
 */

import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

/**
 * Hook que retorna el valor completo del contexto de autenticacion.
 * @returns {object} Objeto con estado y funciones de autenticacion/accesibilidad.
 * @throws {Error} Si se usa fuera de un AuthProvider.
 */
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};

export default useAuth;
