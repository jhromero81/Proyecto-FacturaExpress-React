#!/usr/bin/env node
/**
 * scripts/usuario-clave.js
 * Consulta usuarios y fija o restablece su contrasena.
 *
 * Por que existe: el seed de la base de datos compartida (la usan el frontend
 * React y el de FacturaExpress-V3) no trae contrasenas conocidas por defecto;
 * las toma de SEED_*_PASSWORD o las genera y las imprime una sola vez. Cuando
 * ese valor se pierde, no habia forma de recuperar el acceso sin borrar al
 * usuario y volver a sembrar.
 *
 * Uso:
 *   npm run usuario:clave -- --lista
 *   npm run usuario:clave -- --nit 900.123.456-7
 *   npm run usuario:clave -- --nit 900.123.456-7 --password "MiClave123"
 *   npm run usuario:clave -- --nit 900.123.456-7 --actualizar-env
 *
 * Opciones:
 *   --lista            Lista los usuarios (NIT, rol, nombre, estado).
 *   --nit <nit>        Usuario a modificar (obligatorio salvo con --lista).
 *   --password <txt>   Contrasena nueva. Si se omite se pide por consola
 *                      (sin eco) o, si no hay terminal, se genera aleatoria.
 *   --actualizar-env   Escribe el valor en SEED_<ROL>_PASSWORD del .env de
 *                      este backend. Nunca se hace por defecto.
 *   --sync-angular     Ademas actualiza ../FacturaExpress-V3/backend/.env
 *                      (requiere --actualizar-env). Util porque ambos
 *                      frontends comparten la misma base de datos.
 *   --sin-imprimir     No muestra la contrasena en pantalla.
 *
 * La contrasena debe cumplir la politica de la version Angular: minimo 8
 * caracteres con al menos una minuscula, una mayuscula y un digito.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../config/db');

/** Coste de bcrypt: el mismo que usa el seed */
const COSTE_BCRYPT = 10;

/** Minimo de caracteres exigido por la politica compartida */
const MIN_LONGITUD = 8;

/** Rol -> variable del .env donde vive su contrasena de seed */
const VARIABLE_POR_ROL = {
  admin: 'SEED_ADMIN_PASSWORD',
  vendedor: 'SEED_VENDEDOR_PASSWORD',
  contador: 'SEED_CONTADOR_PASSWORD',
};

/** Lee los argumentos en pares --clave valor y banderas sueltas */
function leerArgumentos(argv) {
  const opciones = { lista: false, actualizarEnv: false, syncAngular: false, sinImprimir: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const siguiente = argv[i + 1];
    switch (arg) {
      case '--lista':
        opciones.lista = true;
        break;
      case '--nit':
        opciones.nit = siguiente;
        i += 1;
        break;
      case '--password':
        opciones.password = siguiente;
        i += 1;
        break;
      case '--actualizar-env':
        opciones.actualizarEnv = true;
        break;
      case '--sync-angular':
        opciones.syncAngular = true;
        break;
      case '--sin-imprimir':
        opciones.sinImprimir = true;
        break;
      case '--help':
      case '-h':
        opciones.ayuda = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Opcion desconocida: ${arg}`);
        }
    }
  }
  return opciones;
}

/**
 * Comprueba la politica de contrasenas.
 * @param {string} clave
 * @returns {string[]} Lista de incumplimientos (vacia si cumple)
 */
function incumplimientos(clave) {
  const fallos = [];
  if (!clave || clave.length < MIN_LONGITUD) {
    fallos.push(`debe tener al menos ${MIN_LONGITUD} caracteres`);
  }
  if (!/[a-z]/.test(clave)) fallos.push('debe incluir una minuscula');
  if (!/[A-Z]/.test(clave)) fallos.push('debe incluir una mayuscula');
  if (!/[0-9]/.test(clave)) fallos.push('debe incluir un digito');
  return fallos;
}

/** Genera una contrasena aleatoria que cumple la politica */
function generarClave() {
  const letras = 'abcdefghijkmnopqrstuvwxyz';
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digitos = '23456789';
  // Sin '#': un valor sin comillas con # se trunca al releer el .env
  const signos = '!@$%&*-_';
  const elegir = (conjunto) => conjunto[crypto.randomInt(conjunto.length)];

  // Base de 16 caracteres garantizando los cuatro tipos
  const caracteres = [elegir(letras), elegir(mayusculas), elegir(digitos), elegir(signos)];
  const todos = letras + mayusculas + digitos + signos;
  while (caracteres.length < 16) caracteres.push(elegir(todos));

  // Mezcla Fisher-Yates con entropia criptografica
  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}

/**
 * Pide la contrasena por consola sin mostrarla.
 * @returns {Promise<string>} Texto introducido (vacio si se cancela)
 */
function pedirClaveOculta() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const escribir = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (texto) => {
      // Se deja pasar el mensaje, se oculta lo tecleado
      if (texto.includes('Contrasena nueva')) escribir.call(rl, texto);
    };
    rl.question('Contrasena nueva (Enter para generar una aleatoria): ', (respuesta) => {
      rl.close();
      process.stdout.write('\n');
      resolve((respuesta || '').trim());
    });
  });
}

/**
 * Reemplaza el valor de una variable en un archivo .env conservando el resto.
 * @param {string} ruta
 * @param {string} variable
 * @param {string} valor
 * @returns {'actualizada'|'agregada'|'sin-archivo'}
 */
function escribirEnEnv(ruta, variable, valor) {
  if (!fs.existsSync(ruta)) return 'sin-archivo';

  // dotenv corta el valor en un # sin comillas y se come los espacios: si el
  // valor tiene caracteres especiales se escribe entre comillas dobles.
  const seguro = /[\s#"']/.test(valor)
    ? `"${valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : valor;

  const original = fs.readFileSync(ruta, 'utf8');
  const salto = original.includes('\r\n') ? '\r\n' : '\n';
  const lineas = original.split(/\r?\n/);
  const patron = new RegExp(`^${variable}=`);
  const indice = lineas.findIndex((l) => patron.test(l));

  if (indice >= 0) {
    lineas[indice] = `${variable}=${seguro}`;
  } else {
    if (lineas.length && lineas[lineas.length - 1] === '') lineas.pop();
    lineas.push(`${variable}=${seguro}`, '');
  }

  fs.writeFileSync(ruta, lineas.join(salto), 'utf8');
  return indice >= 0 ? 'actualizada' : 'agregada';
}

/** Imprime la tabla de usuarios */
async function listarUsuarios() {
  const [filas] = await pool.query(
    'SELECT nit, nombre, rol, activo, created_at FROM usuarios ORDER BY id'
  );

  if (filas.length === 0) {
    console.log('No hay usuarios registrados. Ejecute `npm run db:seed`.');
    return;
  }

  console.log('\nUsuarios registrados:\n');
  for (const u of filas) {
    const estado = u.activo ? 'activo' : 'INACTIVO';
    console.log(`  ${u.nit.padEnd(16)} ${String(u.rol).padEnd(10)} ${u.nombre} (${estado})`);
  }
  console.log('\nLas contrasenas no se pueden recuperar: son hashes bcrypt.');
  console.log('Para fijar una nueva use: npm run usuario:clave -- --nit <nit>\n');
}

/** Punto de entrada */
async function principal() {
  const opciones = leerArgumentos(process.argv.slice(2));

  if (opciones.ayuda) {
    const cabecera = fs.readFileSync(__filename, 'utf8').split('*/')[0];
    console.log(cabecera.replace(/^\/\*\*?/, '').replace(/^ \* ?/gm, ''));
    return;
  }

  if (opciones.lista) {
    await listarUsuarios();
    return;
  }

  if (!opciones.nit) {
    throw new Error('Indique el usuario con --nit <nit> (o use --lista para verlos).');
  }

  const [filas] = await pool.query('SELECT id, nit, nombre, rol FROM usuarios WHERE nit = ?', [
    opciones.nit.trim(),
  ]);

  if (filas.length === 0) {
    throw new Error(`No existe un usuario con NIT ${opciones.nit}. Use --lista para ver los NIT validos.`);
  }

  const usuario = filas[0];

  // 1) Contrasena: argumento, consola oculta o generada
  let clave = opciones.password;
  if (!clave) {
    clave = process.stdin.isTTY ? await pedirClaveOculta() : '';
    if (!clave) clave = generarClave();
  }

  const fallos = incumplimientos(clave);
  if (fallos.length > 0) {
    throw new Error(`La contrasena no cumple la politica: ${fallos.join(', ')}.`);
  }

  // 2) Actualizar el hash
  const hash = await bcrypt.hash(clave, COSTE_BCRYPT);
  await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, usuario.id]);

  console.log(`\nContrasena actualizada para ${usuario.nombre} (${usuario.nit}, rol ${usuario.rol}).`);
  if (opciones.sinImprimir) {
    console.log('La contrasena no se muestra (--sin-imprimir). Guardela en un lugar seguro.');
  } else {
    console.log(`Contrasena nueva: ${clave}`);
    console.log('Anotela ahora: solo queda guardada como hash y no se puede recuperar.');
  }

  // 3) Sincronizar el .env si se pidio explicitamente
  const variable = VARIABLE_POR_ROL[usuario.rol];
  if (opciones.actualizarEnv) {
    if (!variable) {
      console.log(`\nAviso: el rol "${usuario.rol}" no tiene variable SEED_* asociada; no se toco ningun .env.`);
    } else {
      const envLocal = path.join(__dirname, '..', '.env');
      console.log(`\n.env de este backend: ${variable} ${escribirEnEnv(envLocal, variable, clave)}.`);

      if (opciones.syncAngular) {
        const envAngular = path.resolve(__dirname, '../../FacturaExpress-V3/backend/.env');
        console.log(`.env de la version Angular: ${variable} ${escribirEnEnv(envAngular, variable, clave)}.`);
      }
    }
  } else if (variable) {
    console.log(
      `\nNota: no se modifico ningun .env. Para dejar constancia en ${variable} ` +
        'repita el comando con --actualizar-env (y --sync-angular si quiere tocar el de V3).'
    );
  }
}

principal()
  .catch((error) => {
    console.error(`\nError: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
