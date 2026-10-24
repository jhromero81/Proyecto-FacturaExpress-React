/**
 * scripts/migrate.js
 * Migracion de la base de datos a la version 2.x del esquema.
 * Aplica, de forma idempotente, los cambios que el seed por si
 * solo no puede aplicar sobre bases de datos ya creadas:
 *   - Nuevas columnas DIAN en la tabla facturas.
 *   - Cambio del ENUM de estado (enviado/rechazado/procesando/anulada ->
 *     pendiente/enviada/rechazada), alineado al modelo Java.
 *   - Creacion de las tablas errores_sistema, logs_auditoria,
 *     reportes y backups.
 *
 * Uso: npm run db:migrate
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'facturaexpress_apirest',
  multipleStatements: true,
};

/**
 * Verifica si una tabla existe en la base de datos.
 * @param {object} connection - Conexion MySQL.
 * @param {string} tabla - Nombre de la tabla.
 * @returns {Promise<boolean>}
 */
async function existeTabla(connection, tabla) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    [tabla]
  );
  return Number(rows[0].total) > 0;
}

/**
 * Verifica si una columna existe en una tabla.
 * @param {object} connection - Conexion MySQL.
 * @param {string} tabla - Nombre de la tabla.
 * @param {string} columna - Nombre de la columna.
 * @returns {Promise<boolean>}
 */
async function existeColumna(connection, tabla, columna) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tabla, columna]
  );
  return Number(rows[0].total) > 0;
}

/**
 * Consulta el tipo actual de una columna.
 * @param {object} connection - Conexion MySQL.
 * @param {string} tabla - Nombre de la tabla.
 * @param {string} columna - Nombre de la columna.
 * @returns {Promise<string>} Tipo de la columna.
 */
async function tipoColumna(connection, tabla, columna) {
  const [rows] = await connection.query(
    `SELECT column_type AS tipo
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tabla, columna]
  );
  return rows.length > 0 ? String(rows[0].tipo) : '';
}

/**
 * Aplica la migracion de forma idempotente.
 */
async function main() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log('[migrate] Conectado a MySQL.');

    // ---- Nuevas columnas en facturas ----
    if (await existeTabla(connection, 'facturas')) {
      const columnasFacturas = [
        ['firma_estado', 'VARCHAR(20) NOT NULL DEFAULT \'pendiente\''],
        ['intentos_dian', 'INT NOT NULL DEFAULT 0'],
        ['correo_enviado', 'TINYINT(1) NOT NULL DEFAULT 0'],
        // Fase 1: medio de pago y vencimiento de las ventas a credito
        ['medio_pago', "ENUM('efectivo','tarjeta','transferencia','credito') NOT NULL DEFAULT 'efectivo'"],
        ['plazo_dias', 'INT UNSIGNED NULL'],
        ['fecha_vencimiento', 'DATE NULL'],
      ];
      for (const [columna, definicion] of columnasFacturas) {
        if (!(await existeColumna(connection, 'facturas', columna))) {
          await connection.query(
            `ALTER TABLE facturas ADD COLUMN ${columna} ${definicion}`
          );
          console.log(`[migrate] Columna facturas.${columna} agregada.`);
        }
      }

      // ---- ENUM de estado alineado al modelo Java ----
      const tipo = await tipoColumna(connection, 'facturas', 'estado');
      if (tipo.includes('enviado')) {
        console.log('[migrate] Migrando estados de factura al modelo Java (pendiente/enviada/rechazada)...');
        await connection.query(
          `UPDATE facturas
              SET estado = CASE estado
                    WHEN 'enviado' THEN 'enviada'
                    WHEN 'rechazado' THEN 'rechazada'
                    WHEN 'procesando' THEN 'pendiente'
                    WHEN 'anulada' THEN 'rechazada'
                    ELSE 'pendiente'
                  END`
        );
        await connection.query(
          `ALTER TABLE facturas
             MODIFY COLUMN estado ENUM('pendiente','enviada','rechazada')
             NOT NULL DEFAULT 'pendiente'`
        );
        console.log('[migrate] ENUM de estado actualizado.');
      } else if (tipo && !tipo.includes('pendiente')) {
        await connection.query(
          `ALTER TABLE facturas
             MODIFY COLUMN estado ENUM('pendiente','enviada','rechazada')
             NOT NULL DEFAULT 'pendiente'`
        );
        console.log('[migrate] ENUM de estado verificado.');
      }

      // ---- Estado 'anulada' para las notas credito ----
      const tipoEstado = await tipoColumna(connection, 'facturas', 'estado');
      if (tipoEstado && tipoEstado.includes('pendiente') && !tipoEstado.includes('anulada')) {
        await connection.query(
          `ALTER TABLE facturas
             MODIFY COLUMN estado ENUM('pendiente','enviada','rechazada','anulada')
             NOT NULL DEFAULT 'pendiente'`
        );
        console.log('[migrate] Estado "anulada" agregado al ENUM de facturas.');
      }
    }

    // ---- Tablas nuevas ----
    const tablas = {
      errores_sistema: `
        CREATE TABLE IF NOT EXISTS errores_sistema (
          id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          mensaje           TEXT NOT NULL,
          tipo              VARCHAR(50) NOT NULL DEFAULT 'otro',
          factura_id        INT UNSIGNED NULL,
          resuelto          TINYINT(1)  NOT NULL DEFAULT 0,
          fecha_resolucion  DATETIME    NULL,
          created_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_errores_factura
            FOREIGN KEY (factura_id) REFERENCES facturas (id) ON DELETE SET NULL
        ) ENGINE=InnoDB`,
      logs_auditoria: `
        CREATE TABLE IF NOT EXISTS logs_auditoria (
          id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          usuario_id     INT UNSIGNED NULL,
          accion         VARCHAR(200) NOT NULL,
          tabla_afectada VARCHAR(50)  NOT NULL DEFAULT 'general',
          registro_id    BIGINT       NULL,
          ip_origen      VARCHAR(45)  NULL,
          created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_logs_usuario
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
        ) ENGINE=InnoDB`,
      reportes: `
        CREATE TABLE IF NOT EXISTS reportes (
          id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          tipo           VARCHAR(50)  NOT NULL,
          periodo        VARCHAR(20)  NULL,
          fecha_inicio   DATE         NULL,
          fecha_fin      DATE         NULL,
          archivo        VARCHAR(255) NULL,
          tamano         BIGINT       NOT NULL DEFAULT 0,
          usuario_id     INT UNSIGNED NULL,
          created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_reportes_usuario
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
        ) ENGINE=InnoDB`,
      consecutivos: `
        CREATE TABLE IF NOT EXISTS consecutivos (
          clave      VARCHAR(40) NOT NULL PRIMARY KEY,
          ultimo     INT UNSIGNED NOT NULL DEFAULT 0,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                     ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB`,
      notas_credito: `
        CREATE TABLE IF NOT EXISTS notas_credito (
          id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          factura_id INT UNSIGNED NOT NULL,
          numero     VARCHAR(30)  NOT NULL UNIQUE,
          fecha      DATETIME     NOT NULL,
          motivo     VARCHAR(200) NOT NULL,
          subtotal   DECIMAL(14,2) NOT NULL,
          iva        DECIMAL(14,2) NOT NULL,
          total      DECIMAL(14,2) NOT NULL,
          usuario_id INT UNSIGNED NULL,
          created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_nc_factura
            FOREIGN KEY (factura_id) REFERENCES facturas (id),
          CONSTRAINT fk_nc_usuario
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
        ) ENGINE=InnoDB`,
      backups: `
        CREATE TABLE IF NOT EXISTS backups (
          id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          archivo     VARCHAR(255) NOT NULL,
          tamano      BIGINT       NOT NULL DEFAULT 0,
          usuario_id  INT UNSIGNED NULL,
          created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_backups_usuario
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
        ) ENGINE=InnoDB`,
    };

    for (const [tabla, ddl] of Object.entries(tablas)) {
      if (!(await existeTabla(connection, tabla))) {
        await connection.query(ddl);
        console.log(`[migrate] Tabla ${tabla} creada.`);
      }
    }

    // ---- Consecutivos: continuar donde iban las facturas ya emitidas ----
    if ((await existeTabla(connection, 'consecutivos')) && (await existeTabla(connection, 'facturas'))) {
      const [filas] = await connection.query(
        `SELECT CONCAT('FAC-', DATE_FORMAT(fecha, '%Y%m')) AS clave,
                MAX(CAST(SUBSTRING_INDEX(numero, '-', -1) AS UNSIGNED)) AS ultimo
           FROM facturas
          WHERE numero LIKE 'FAC-%'
          GROUP BY clave`
      );
      for (const fila of filas) {
        await connection.query(
          `INSERT INTO consecutivos (clave, ultimo) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE ultimo = GREATEST(ultimo, VALUES(ultimo))`,
          [fila.clave, Number(fila.ultimo) || 0]
        );
      }
      console.log(`[migrate] Consecutivos sincronizados (${filas.length} prefijo/s).`);
    }

    console.log('[migrate] Migracion completada con exito.');
  } catch (error) {
    console.error('[migrate] Error durante la migracion:', error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();
