/**
 * scripts/seed.js
 * Script de poblacion de datos de ejemplo (seed).
 * Inserta los registros por defecto del sistema: empresa,
 * usuarios, clientes y productos. Es idempotente: si los datos
 * ya existen, no los duplica.
 *
 * Uso: npm run db:seed
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

const {
  EMPRESA_DEFAULT,
  PRODUCTOS_DEFAULT,
  CLIENTES_DEFAULT,
  USUARIOS_DEFAULT,
} = require('../db/seedData');

dotenv.config();

/** Configuracion de conexion tomada de las variables de entorno */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  // No se conecta directamente a la base de datos porque puede
  // no existir aun; el esquema (schema.sql) la crea e invoca USE.
  multipleStatements: true,
};

/**
 * Ejecuta el script de esquema (schema.sql) para crear la
 * estructura de tablas si aun no existe. Las sentencias se
 * ejecutan de una en una para tolerar re-ejecuciones
 * (indices o elementos ya existentes).
 */
async function ejecutarEsquema(connection) {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const esquemaCrudo = fs.readFileSync(schemaPath, 'utf8');

  // schema.sql trae el nombre de la base fijo. Si DB_NAME esta definido se
  // sustituye, para que el seed y la API no puedan apuntar a bases distintas.
  const nombreBase = (process.env.DB_NAME || 'facturaexpress_apirest').trim();
  if (!/^[A-Za-z0-9_]+$/.test(nombreBase)) {
    throw new Error(`DB_NAME invalido: "${nombreBase}"`);
  }
  const schema = esquemaCrudo.replace(/facturaexpress_apirest/g, nombreBase);

  const sentencias = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const sentencia of sentencias) {
    try {
      await connection.query(sentencia);
    } catch (error) {
      // Tolerar objetos ya creados en re-ejecuciones (idempotencia)
      const mensaje = error.message || '';
      if (!/duplicate key name|already exists/i.test(mensaje)) {
        throw error;
      }
    }
  }
  console.log('[seed] Esquema de base de datos verificado.');
}

/**
 * Pobla la tabla empresa con el registro unico (id = 1).
 */
async function seedEmpresa(connection) {
  const [rows] = await connection.query('SELECT id FROM empresa WHERE id = 1');
  if (rows.length > 0) {
    console.log('[seed] La empresa ya estaba registrada. Omitiendo.');
    return;
  }

  await connection.query(
    `INSERT INTO empresa
      (id, nit, razon_social, email_facturacion, telefono, resolucion_dian, fecha_expiracion_cert, ultima_sync)
     VALUES (1, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      EMPRESA_DEFAULT.nit,
      EMPRESA_DEFAULT.razonSocial,
      EMPRESA_DEFAULT.emailFacturacion,
      EMPRESA_DEFAULT.telefono,
      EMPRESA_DEFAULT.resolucionDian,
      EMPRESA_DEFAULT.fechaExpiracionCert,
    ]
  );
  console.log('[seed] Empresa registrada:', EMPRESA_DEFAULT.razonSocial);
}

/**
 * Genera una contrasena aleatoria que cumple la politica compartida
 * (minimo 8 caracteres con minuscula, mayuscula y digito).
 * @returns {string}
 */
function generarClaveAleatoria() {
  const letras = 'abcdefghijkmnopqrstuvwxyz';
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digitos = '23456789';
  // Sin '#': un valor sin comillas con # se trunca al releer el .env
  const signos = '!@$%&*-_';
  const elegir = (conjunto) => conjunto[crypto.randomInt(conjunto.length)];

  const caracteres = [elegir(letras), elegir(mayusculas), elegir(digitos), elegir(signos)];
  const todos = letras + mayusculas + digitos + signos;
  while (caracteres.length < 16) caracteres.push(elegir(todos));

  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}

/**
 * Resuelve la contrasena de un usuario del seed.
 * Prioridad: variable de entorno -> aleatoria generada en el momento.
 * @param {{nit: string, rol: string, passwordEnv: string}} usuario
 * @returns {{clave: string, origen: 'entorno'|'generada'}}
 */
function resolverClave(usuario) {
  const desdeEntorno = process.env[usuario.passwordEnv];
  if (desdeEntorno && desdeEntorno.trim()) {
    const clave = desdeEntorno.trim();
    const debil = clave.length < 8 || !/[a-z]/.test(clave) || !/[A-Z]/.test(clave) || !/[0-9]/.test(clave);
    if (debil) {
      console.warn(
        `[seed] Aviso: ${usuario.passwordEnv} no cumple la politica (min. 8 con minuscula, mayuscula y digito). Se usa tal cual.`
      );
    }
    return { clave, origen: 'entorno' };
  }
  return { clave: generarClaveAleatoria(), origen: 'generada' };
}

/**
 * Pobla la tabla usuarios con contrasenas encriptadas.
 * Si no hay contrasena en el entorno se genera una y se muestra UNA sola vez.
 */
async function seedUsuarios(connection) {
  const [rows] = await connection.query('SELECT COUNT(*) AS total FROM usuarios');
  if (rows[0].total > 0) {
    console.log('[seed] Ya existen usuarios. Omitiendo.');
    return;
  }

  const credenciales = [];

  for (const usuario of USUARIOS_DEFAULT) {
    const { clave, origen } = resolverClave(usuario);
    const passwordHash = await bcrypt.hash(clave, 10);
    await connection.query(
      `INSERT INTO usuarios (nit, nombre, email, telefono, rol, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [usuario.nit, usuario.nombre, usuario.email, usuario.telefono, usuario.rol, passwordHash]
    );
    credenciales.push({ nit: usuario.nit, rol: usuario.rol, clave, origen });
  }

  console.log(`[seed] ${USUARIOS_DEFAULT.length} usuarios creados (contrasenas encriptadas).`);

  const generadas = credenciales.filter((c) => c.origen === 'generada');
  if (generadas.length > 0) {
    console.log('\n[seed] Contrasenas generadas (se muestran una sola vez, guardelas ahora):');
    for (const c of generadas) {
      console.log(`  ${c.nit}  (${c.rol})  ->  ${c.clave}`);
    }
    console.log('[seed] Para fijar otras: npm run usuario:clave -- --nit <nit>\n');
  }
}

/**
 * Pobla la tabla clientes con el directorio de ejemplo.
 */
async function seedClientes(connection) {
  const [rows] = await connection.query('SELECT COUNT(*) AS total FROM clientes');
  if (rows[0].total > 0) {
    console.log('[seed] Ya existen clientes. Omitiendo.');
    return;
  }

  for (const cliente of CLIENTES_DEFAULT) {
    await connection.query(
      'INSERT INTO clientes (identificacion, nombre, email, telefono) VALUES (?, ?, ?, ?)',
      [cliente.identificacion, cliente.nombre, cliente.email, cliente.telefono]
    );
  }
  console.log(`[seed] ${CLIENTES_DEFAULT.length} clientes creados.`);
}

/**
 * Pobla la tabla productos con el catalogo de ejemplo.
 */
async function seedProductos(connection) {
  const [rows] = await connection.query('SELECT COUNT(*) AS total FROM productos');
  if (rows[0].total > 0) {
    console.log('[seed] Ya existen productos. Omitiendo.');
    return;
  }

  for (const producto of PRODUCTOS_DEFAULT) {
    await connection.query(
      'INSERT INTO productos (codigo, nombre, precio, iva, stock) VALUES (?, ?, ?, ?, ?)',
      [producto.codigo, producto.nombre, producto.precio, producto.iva, producto.stock]
    );
  }
  console.log(`[seed] ${PRODUCTOS_DEFAULT.length} productos creados.`);
}

/**
 * Funcion principal del seed.
 */
async function main() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('[seed] Conectado a MySQL.');

    await ejecutarEsquema(connection);
    await seedEmpresa(connection);
    await seedUsuarios(connection);
    await seedClientes(connection);
    await seedProductos(connection);

    console.log('[seed] Poblacion de datos completada con exito.');
  } catch (error) {
    console.error('[seed] Error durante la poblacion de datos:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

// Solo se ejecuta al invocarlo directamente: las pruebas importan las
// funciones puras (generacion y resolucion de contrasenas) sin tocar la BD.
if (require.main === module) {
  main();
}

module.exports = { generarClaveAleatoria, resolverClave };
