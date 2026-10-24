/**
 * vite.config.js
 * Configuracion del bundler Vite para el frontend de FacturaExpress.
 * Reemplaza a Create React App (react-scripts).
 */

// defineConfig se importa de 'vitest/config' para que Vite y Vitest compartan
// la misma configuracion (con 'vite' el bloque test se ignora en tiempo de ejecucion).
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: 'build',
    sourcemap: false,
  },
  // Pruebas unitarias con Vitest (mismas convenciones que la version Angular:
  // pruebas de funciones puras en src/utils)
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.js'],
    reporters: 'default',
  },
});
