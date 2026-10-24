/**
 * tests/api.test.js
 * Pruebas de humo de la API con supertest (sin abrir puerto).
 *
 * Cubren lo que debe cumplirse siempre, incluso sin base de datos:
 *  - la API responde y reporta su salud;
 *  - una ruta inexistente devuelve JSON, no HTML;
 *  - las rutas protegidas rechazan peticiones sin sesion;
 *  - el control de origen bloquea peticiones mutantes de sitios ajenos.
 *
 * Ejecutar: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../server');

test('GET /api/health responde 200 con el servicio identificado', async () => {
  const res = await request(app).get('/api/health');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.match(res.body.servicio, /FacturaExpress/);
});

test('una ruta inexistente responde 404 en JSON', async () => {
  const res = await request(app).get('/api/no-existe');

  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test('una ruta protegida sin cookie responde 401', async () => {
  const res = await request(app).get('/api/clientes');

  assert.equal(res.status, 401);
});

test('una peticion mutante de un origen ajeno se rechaza con 403', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', 'http://sitio-malicioso.example')
    .send({ nit: '900.123.456-7', password: 'cualquiera' });

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
});

test('una peticion mutante del frontend autorizado no la bloquea el control de origen', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', 'http://localhost:3000')
    .send({});

  // No debe ser 403: el control de origen la deja pasar y es la validacion
  // de campos (400) la que responde.
  assert.notEqual(res.status, 403);
  assert.equal(res.status, 400);
});

test('las peticiones de lectura no se someten al control de origen', async () => {
  const res = await request(app)
    .get('/api/health')
    .set('Origin', 'http://sitio-malicioso.example');

  assert.equal(res.status, 200);
});
