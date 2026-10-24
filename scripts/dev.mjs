#!/usr/bin/env node
/**
 * scripts/dev.mjs
 * Arranca la API y el frontend juntos, con los registros etiquetados y sin
 * necesidad de dos terminales.
 *
 * Por que existe: el frontend muestra «No se pudo conectar con el servidor»
 * cuando la API no esta levantada, y el mensaje no dice que falte arrancarla.
 * Con un solo comando es dificil olvidar una de las dos piezas.
 *
 * Uso:
 *   npm run dev            # API en 4000 + frontend en 3000
 *   PORT=4100 VITE_PORT=3100 npm run dev
 *
 * Ctrl+C detiene los dos procesos.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const API_DIR = join(RAIZ, 'backend');
const PORT = process.env.PORT || '4000';
const VITE_PORT = process.env.VITE_PORT || '3000';

if (!existsSync(join(API_DIR, 'server.js'))) {
  console.error('[dev] No se encontro backend/server.js. Ejecute el comando desde la raiz del proyecto.');
  process.exit(1);
}

/** Reenvia la salida de un hijo con prefijo y color */
function etiquetar(prefijo, color, flujo) {
  let pendiente = '';
  flujo.setEncoding('utf8');
  flujo.on('data', (trozo) => {
    pendiente += trozo;
    const lineas = pendiente.split(/\r?\n/);
    pendiente = lineas.pop() ?? '';
    for (const linea of lineas) {
      if (linea.trim()) process.stdout.write(`${color}${prefijo}\x1b[0m ${linea}\n`);
    }
  });
}

const hijos = [];

/** Lanza un proceso y lo registra para poder cerrarlo */
function lanzar(nombre, color, comando, args, cwd, extraEnv = {}) {
  const hijo = spawn(comando, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  etiquetar(nombre, color, hijo.stdout);
  etiquetar(nombre, color, hijo.stderr);
  hijos.push({ nombre, hijo });

  hijo.on('exit', (codigo, senal) => {
    if (senal) return;
    if (codigo !== 0) {
      console.error(`${color}${nombre}\x1b[0m termino con codigo ${codigo}.`);
    }
  });

  return hijo;
}

console.log(`\n[dev] API      -> http://localhost:${PORT}`);
console.log(`[dev] Frontend -> http://localhost:${VITE_PORT}`);
console.log('[dev] Ctrl+C detiene ambos procesos\n');

// API (Express + MySQL)
lanzar('api', '\x1b[36m', process.execPath, ['server.js'], API_DIR, { PORT });

// Frontend (Vite)
lanzar(
  'web',
  '\x1b[35m',
  process.execPath,
  [join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(VITE_PORT)],
  RAIZ,
  { VITE_PORT }
);

/** Cierra todos los hijos y termina */
function cerrar(todo = 'SIGTERM') {
  for (const { nombre, hijo } of hijos) {
    if (!hijo.killed) {
      console.log(`[dev] Deteniendo ${nombre}...`);
      hijo.kill(todo);
    }
  }
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', () => cerrar('SIGINT'));
process.on('SIGTERM', () => cerrar('SIGTERM'));
process.on('exit', () => {
  for (const { hijo } of hijos) {
    if (!hijo.killed) hijo.kill();
  }
});
