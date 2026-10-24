/**
 * tests/flujo-venta.test.js
 * Pruebas del flujo completo de venta contra la base de datos real:
 *
 *  - totales calculados por el servidor (subtotal, IVA, total);
 *  - descuento de stock dentro de la transaccion;
 *  - consecutivo que no se repite entre ventas;
 *  - dos ventas simultaneas del ultimo articulo: una pasa y la otra no;
 *  - medio de pago y vencimiento en las ventas a credito;
 *  - anulacion con nota credito (devuelve stock y marca la factura);
 *  - la ruta DELETE ya no borra facturas.
 *
 * Requiere base de datos. Si no hay conexion, las pruebas se marcan como
 * omitidas en lugar de fallar, para que el resto de la suite siga siendo
 * util en un entorno sin MySQL.
 *
 * Ejecutar: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../server');
const { pool } = require('../config/db');
const { generateToken } = require('../config/jwt');

/** Sufijo unico para no chocar con datos reales entre ejecuciones */
const SUFIJO = `${Date.now()}`.slice(-9);

let dbDisponible = false;
let token = null;
let usuarioId = null;
let clienteId = null;
let productoSueltoId = null; // stock amplio, para pruebas normales
let productoUnicoId = null; // stock 1, para la prueba de concurrencia

const conAuth = (peticion) => peticion.set('Authorization', `Bearer ${token}`);

/**
 * Crea un producto de prueba con el stock indicado.
 * @param {string} codigo - Codigo unico.
 * @param {number} stock - Unidades disponibles.
 * @param {number} precio - Precio unitario.
 * @returns {Promise<number>} id del producto.
 */
async function crearProducto(codigo, stock, precio) {
  const [result] = await pool.query(
    'INSERT INTO productos (codigo, nombre, precio, iva, stock, activo) VALUES (?, ?, ?, 19, ?, 1)',
    [codigo, `Producto prueba ${codigo}`, precio, stock]
  );
  return result.insertId;
}

/** Consulta el stock actual de un producto */
async function stockDe(id) {
  const [rows] = await pool.query('SELECT stock FROM productos WHERE id = ?', [id]);
  return Number(rows[0].stock);
}

test.before(async () => {
  try {
    const [usuarios] = await pool.query("SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1");
    assert.ok(usuarios.length > 0, 'no hay usuario administrador');
    usuarioId = usuarios[0].id;

    const [clientes] = await pool.query(
      'INSERT INTO clientes (identificacion, nombre, email, telefono, activo) VALUES (?, ?, ?, ?, 1)',
      [`T${SUFIJO}`, `Cliente prueba ${SUFIJO}`, `prueba${SUFIJO}@example.com`, '3000000000']
    );
    clienteId = clientes.insertId;

    productoSueltoId = await crearProducto(`PS${SUFIJO}`, 50, 1000);
    productoUnicoId = await crearProducto(`PU${SUFIJO}`, 1, 5000);

    token = generateToken({ id: usuarioId, nit: '900.123.456-7', rol: 'admin' });
    dbDisponible = true;
  } catch (error) {
    dbDisponible = false;
    console.warn('[pruebas] Sin base de datos, se omiten las pruebas del flujo de venta:', error.message);
  }
});

test.after(async () => {
  if (dbDisponible) {
    // Limpieza directa por SQL: la API ya no permite borrar facturas
    const [facturas] = await pool.query(
      'SELECT id FROM facturas WHERE cliente_id = ?',
      [clienteId]
    );
    for (const factura of facturas) {
      await pool.query('DELETE FROM notas_credito WHERE factura_id = ?', [factura.id]);
      await pool.query('DELETE FROM factura_items WHERE factura_id = ?', [factura.id]);
      await pool.query('DELETE FROM facturas WHERE id = ?', [factura.id]);
    }
    await pool.query('DELETE FROM productos WHERE id IN (?, ?)', [productoSueltoId, productoUnicoId]);
    await pool.query('DELETE FROM clientes WHERE id = ?', [clienteId]);
  }
  await pool.end();
});

test('una venta calcula totales, guarda el medio de pago y descuenta stock', async (t) => {
  if (!dbDisponible) return t.skip('sin base de datos');

  const stockInicial = await stockDe(productoSueltoId);

  const res = await conAuth(request(app).post('/api/facturas')).send({
    clienteId,
    items: [{ productoId: productoSueltoId, cantidad: 3 }],
    descuento: 10,
    medioPago: 'tarjeta',
  });

  assert.equal(res.status, 201);

  const factura = res.body.factura;
  // 3 x 1.000 = 3.000; 10 % = 300; base 2.700; IVA 19 % = 513; total 3.213
  assert.equal(factura.subtotal, 3000);
  assert.equal(factura.descuento, 300);
  assert.equal(factura.iva, 513);
  assert.equal(factura.total, 3213);
  assert.equal(factura.medioPago, 'tarjeta');
  assert.equal(factura.estado, 'pendiente');
  assert.match(factura.numero, /^FAC-\d{6}-\d{5}$/);

  assert.equal(await stockDe(productoSueltoId), stockInicial - 3, 'el stock debe bajar');
});

test('dos ventas seguidas reciben numeros consecutivos distintos', async (t) => {
  if (!dbDisponible) return t.skip('sin base de datos');

  const una = await conAuth(request(app).post('/api/facturas')).send({
    clienteId,
    items: [{ productoId: productoSueltoId, cantidad: 1 }],
  });
  const otra = await conAuth(request(app).post('/api/facturas')).send({
    clienteId,
    items: [{ productoId: productoSueltoId, cantidad: 1 }],
  });

  assert.equal(una.status, 201);
  assert.equal(otra.status, 201);
  assert.notEqual(una.body.factura.numero, otra.body.factura.numero);

  const seqUna = Number(una.body.factura.numero.split('-').pop());
  const seqOtra = Number(otra.body.factura.numero.split('-').pop());
  assert.equal(seqOtra, seqUna + 1, 'el consecutivo debe avanzar de uno en uno');
});

test('una venta a credito guarda el plazo y la fecha de vencimiento', async (t) => {
  if (!dbDisponible) return t.skip('sin base de datos');

  const res = await conAuth(request(app).post('/api/facturas')).send({
    clienteId,
    items: [{ productoId: productoSueltoId, cantidad: 1 }],
    medioPago: 'credito',
    plazoDias: 30,
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.factura.medioPago, 'credito');
  assert.equal(res.body.factura.plazoDias, 30);

  const vencimiento = new Date(res.body.factura.fechaVencimiento);
  const esperado = new Date();
  esperado.setDate(esperado.getDate() + 30);
  const diferenciaDias = Math.round((vencimiento - esperado) / (24 * 60 * 60 * 1000));
  assert.ok(Math.abs(diferenciaDias) <= 1, `vencimiento a ${diferenciaDias} dias de lo esperado`);
});

test('un medio de pago invalido se rechaza con 400', async (t) => {
  if (!dbDisponible) return t.skip('sin base de datos');

  const res = await conAuth(request(app).post('/api/facturas')).send({
    clienteId,
    items: [{ productoId: productoSueltoId, cantidad: 1 }],
    medioPago: 'bitcoin',
  });

  assert.equal(res.status, 400);
  // El middleware de validacion responde con la lista de campos invalidos
  const campos = (res.body.errors || []).map((e) => e.campo);
  assert.ok(
    campos.includes('medioPago') || /medio de pago/i.test(res.body.message),
    `se esperaba el error de medioPago, llego: ${JSON.stringify(res.body)}`
  );
});

test('no se puede vender mas de lo que hay en stock', async (t) => {
  if (!dbDisponible) return t.skip('sin base de datos');

  const res = await conAuth(request(app).post('/api/facturas')).send({
    clienteId,
    items: [{ productoId: productoUnicoId, cantidad: 5 }],
  });

  assert.equal(res.status, 409);
  assert.match(res.body.message, /stock insuficiente/i);
  assert.equal(await stockDe(productoUnicoId), 1, 'el stock no debe cambiar');
});

test('dos ventas simultaneas del ultimo articulo: una pasa y la otra no', async (t) => {
  if (!dbDisponible) return t.skip('sin base de datos');

  const peticion = () =>
    conAuth(request(app).post('/api/facturas')).send({
      clienteId,
      items: [{ productoId: productoUnicoId, cantidad: 1 }],
    });

  const [a, b] = await Promise.all([peticion(), peticion()]);
  const estados = [a.status, b.status].sort();

  assert.deepEqual(estados, [201, 409], 'exactamente una venta debe pasar');
  assert.equal(await stockDe(productoUnicoId), 0, 'el stock debe quedar en cero, nunca negativo');

  const numeroGanador = (a.status === 201 ? a : b).body.factura.numero;
  assert.match(numeroGanador, /^FAC-\d{6}-\d{5}$/);
});

test('la nota credito anula la factura, devuelve el stock y deja rastro', async (t) => {
  if (!dbDisponible) return t.skip('sin base de datos');

  const stockAntes = await stockDe(productoSueltoId);

  const venta = await conAuth(request(app).post('/api/facturas')).send({
    clienteId,
    items: [{ productoId: productoSueltoId, cantidad: 2 }],
  });
  assert.equal(venta.status, 201);
  const factura = venta.body.factura;
  assert.equal(await stockDe(productoSueltoId), stockAntes - 2);

  const anulacion = await conAuth(
    request(app).post(`/api/facturas/${factura.id}/nota-credito`)
  ).send({ motivo: 'Cliente devuelve la mercancia' });

  assert.equal(anulacion.status, 201);
  assert.equal(anulacion.body.factura.estado, 'anulada');
  assert.match(anulacion.body.nota.numero, /^NC-\d{6}-\d{5}$/);
  assert.equal(anulacion.body.nota.total, factura.total);
  assert.equal(await stockDe(productoSueltoId), stockAntes, 'el stock debe volver');

  // El documento original sigue existiendo
  const consulta = await conAuth(request(app).get(`/api/facturas/${factura.id}`));
  assert.equal(consulta.status, 200);
  assert.equal(consulta.body.factura.estado, 'anulada');

  // Segundo intento de anulacion
  const repetida = await conAuth(
    request(app).post(`/api/facturas/${factura.id}/nota-credito`)
  ).send({ motivo: 'Otra vez' });
  assert.equal(repetida.status, 409);

  // El listado se puede filtrar por anuladas
  const listado = await conAuth(request(app).get('/api/facturas?estado=anulada&limite=100'));
  assert.equal(listado.status, 200);
  assert.ok(
    listado.body.facturas.some((f) => f.id === factura.id),
    'la factura anulada debe aparecer en el filtro'
  );
});

test('la nota credito exige un motivo con contenido', async (t) => {
  if (!dbDisponible) return t.skip('sin base de datos');

  const venta = await conAuth(request(app).post('/api/facturas')).send({
    clienteId,
    items: [{ productoId: productoSueltoId, cantidad: 1 }],
  });

  const res = await conAuth(
    request(app).post(`/api/facturas/${venta.body.factura.id}/nota-credito`)
  ).send({ motivo: 'x' });

  assert.equal(res.status, 400);
});

test('DELETE devuelve 409 y la factura sigue existiendo', async (t) => {
  if (!dbDisponible) return t.skip('sin base de datos');

  const venta = await conAuth(request(app).post('/api/facturas')).send({
    clienteId,
    items: [{ productoId: productoSueltoId, cantidad: 1 }],
  });

  const borrado = await conAuth(request(app).delete(`/api/facturas/${venta.body.factura.id}`));
  assert.equal(borrado.status, 409);
  assert.match(borrado.body.message, /nota credito/i);

  const consulta = await conAuth(request(app).get(`/api/facturas/${venta.body.factura.id}`));
  assert.equal(consulta.status, 200, 'la factura no debe haberse borrado');
});
