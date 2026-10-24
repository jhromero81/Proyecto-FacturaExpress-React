/**
 * tests/seed.test.js
 * Pruebas de las funciones puras del seed: generacion de contrasenas y
 * prioridad entorno -> aleatoria. No tocan la base de datos.
 *
 * Lo que protegen:
 *  - que una base sembrada sin SEED_* nunca quede con una clave adivinable;
 *  - que la clave generada cumpla la politica compartida con Angular;
 *  - que un valor definido por entorno se respete tal cual.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { generarClaveAleatoria, resolverClave } = require('../scripts/seed');

const cumplePolitica = (clave) =>
  clave.length >= 8 && /[a-z]/.test(clave) && /[A-Z]/.test(clave) && /[0-9]/.test(clave);

test('la clave generada tiene 16 caracteres y cumple la politica', () => {
  const clave = generarClaveAleatoria();

  assert.equal(clave.length, 16);
  assert.ok(cumplePolitica(clave), `no cumple la politica: ${clave}`);
  assert.ok(!clave.includes('#'), 'no debe contener # porque rompe el .env');
});

test('dos claves generadas son distintas', () => {
  const claves = new Set(Array.from({ length: 20 }, () => generarClaveAleatoria()));
  assert.equal(claves.size, 20);
});

test('sin variable de entorno se genera una clave y se marca como generada', () => {
  delete process.env.SEED_ADMIN_PASSWORD;
  const usuario = { nit: '900.123.456-7', rol: 'admin', passwordEnv: 'SEED_ADMIN_PASSWORD' };

  const { clave, origen } = resolverClave(usuario);

  assert.equal(origen, 'generada');
  assert.ok(cumplePolitica(clave));
});

test('con variable de entorno se usa ese valor y se marca como entorno', () => {
  process.env.SEED_ADMIN_PASSWORD = 'ClaveDeEntorno123';
  const usuario = { nit: '900.123.456-7', rol: 'admin', passwordEnv: 'SEED_ADMIN_PASSWORD' };

  const { clave, origen } = resolverClave(usuario);

  assert.deepEqual({ clave, origen }, { clave: 'ClaveDeEntorno123', origen: 'entorno' });
  delete process.env.SEED_ADMIN_PASSWORD;
});

test('una variable definida solo con espacios se trata como ausente', () => {
  process.env.SEED_VENDEDOR_PASSWORD = '   ';
  const usuario = { nit: '80.987.654-3', rol: 'vendedor', passwordEnv: 'SEED_VENDEDOR_PASSWORD' };

  const { origen } = resolverClave(usuario);

  assert.equal(origen, 'generada');
  delete process.env.SEED_VENDEDOR_PASSWORD;
});

test('un valor de entorno debil se usa igual pero avisa', () => {
  process.env.SEED_CONTADOR_PASSWORD = 'corta';
  const avisos = [];
  const originalWarn = console.warn;
  console.warn = (mensaje) => avisos.push(String(mensaje));

  const usuario = { nit: '70.555.444-2', rol: 'contador', passwordEnv: 'SEED_CONTADOR_PASSWORD' };
  const { clave, origen } = resolverClave(usuario);

  console.warn = originalWarn;
  delete process.env.SEED_CONTADOR_PASSWORD;

  assert.equal(clave, 'corta');
  assert.equal(origen, 'entorno');
  assert.match(avisos.join(' '), /no cumple la politica/);
});
