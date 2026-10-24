#!/usr/bin/env node
/**
 * scripts/check-tokens.mjs
 * Comprueba que cada variable CSS usada con var(--x) tenga una definicion
 * (--x: valor) en alguna hoja de estilos de src/.
 *
 * Por que existe: la apariencia de este frontend depende de los tokens de
 * `src/styles/index.css`, que es copia de la version Angular
 * (FacturaExpress-V3/frontend/src/styles.css). Si ese archivo se reemplaza
 * por otra paleta, todas las declaraciones con var() se descartan en
 * silencio y la interfaz se degrada sin dar ningun error. Este chequeo
 * convierte ese fallo silencioso en un fallo de build.
 *
 * Uso: node scripts/check-tokens.mjs [--verbose]
 * Salida: exit 0 si todo resuelve, exit 1 si hay tokens sin definir.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath y no .pathname: .pathname devuelve la ruta con %20 cuando el
// proyecto vive bajo una carpeta con espacios y readdirSync no la encuentra.
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(RAIZ, 'src');
const verbose = process.argv.includes('--verbose');

/** Recorre src/ y devuelve las rutas de los .css */
function archivosCss(dir) {
  const salida = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    const info = statSync(ruta);
    if (info.isDirectory()) salida.push(...archivosCss(ruta));
    else if (entrada.endsWith('.css')) salida.push(ruta);
  }
  return salida;
}

/** Elimina comentarios para no confundir ejemplos con codigo real */
const sinComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const archivos = archivosCss(SRC);
const definidos = new Map(); // token -> archivo donde se define
const usos = new Map(); // token -> Set(archivo donde se usa)

for (const archivo of archivos) {
  const css = sinComentarios(readFileSync(archivo, 'utf8'));
  const rel = relative(RAIZ, archivo).replace(/\\/g, '/');

  for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
    if (!definidos.has(m[1])) definidos.set(m[1], rel);
  }

  for (const m of css.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*(,)?/g)) {
    const token = m[1];
    const tieneFallback = Boolean(m[2]);
    if (!usos.has(token)) usos.set(token, { archivos: new Set(), conFallback: 0, sinFallback: 0 });
    const registro = usos.get(token);
    registro.archivos.add(rel);
    if (tieneFallback) registro.conFallback += 1;
    else registro.sinFallback += 1;
  }
}

const huerfanos = [...usos.entries()]
  .filter(([token]) => !definidos.has(token))
  .map(([token, r]) => ({ token, ...r, archivos: [...r.archivos] }))
  .sort((a, b) => b.sinFallback - a.sinFallback || a.token.localeCompare(b.token));

/** Tokens que solo aparecen con fallback: no rompen, pero conviene saberlo */
const soloFallback = huerfanos.filter((h) => h.sinFallback === 0);
/** Tokens sin definir y sin fallback: estos SI degradan la interfaz */
const rotos = huerfanos.filter((h) => h.sinFallback > 0);

if (verbose) {
  console.log(`Hojas de estilo analizadas: ${archivos.length}`);
  console.log(`Tokens definidos: ${definidos.size}`);
  console.log(`Tokens usados: ${usos.size}`);
}

if (soloFallback.length > 0) {
  console.log(`\nAviso: ${soloFallback.length} token(s) sin definir pero con valor de reserva:`);
  for (const h of soloFallback) console.log(`  ${h.token}  (${h.archivos.join(', ')})`);
}

if (rotos.length > 0) {
  console.error('\nERROR: tokens CSS usados sin definicion y sin valor de reserva.');
  console.error('Toda declaracion que los use sera descartada por el navegador.\n');
  for (const h of rotos) {
    console.error(`  ${h.token}  -> ${h.sinFallback} uso(s) sin fallback`);
    for (const a of h.archivos) console.error(`      ${a}`);
  }
  console.error(
    '\nRevisa src/styles/index.css: debe ser copia fiel de\n' +
      'FacturaExpress-V3/frontend/src/styles.css. Ver docs/paridad-ui.md.'
  );
  process.exit(1);
}

console.log(`\nOK: ${usos.size} tokens CSS resuelven correctamente en ${archivos.length} hojas de estilo.`);
