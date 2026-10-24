/**
 * controllers/facturas.controller.js
 * Controlador del modulo de ventas y facturacion electronica.
 * Implementa la logica de negocio completa de una factura:
 *  - Validacion de cliente e items.
 *  - Calculo de subtotal, IVA, descuento (%) y total del servidor.
 *  - Generacion del numero secuencial y del CUNE (hash DIAN).
 *  - Descuento del stock en una transaccion atomica.
 *  - Generacion de XML y PDF, envio por correo y auditoria.
 */

const { pool } = require('../config/db');
const { asyncHandler, createHttpError } = require('../middleware/errorHandler');
const {
  calcularIVA,
  generarNumeroFactura,
  isValidPositiveInt,
  isRequiredString,
  escapeXML,
  escapeCSV,
  mapFacturaRow,
  mapItemRow,
} = require('../utils/helpers');
const { generarCUNE } = require('../utils/cune');
const { registrarAuditoria } = require('../utils/auditoria');
const { registrarError } = require('../utils/errores');
const pdfService = require('../services/pdf.service');
const emailService = require('../services/email.service');

/** Estados que se pueden fijar a mano (la anulacion va por nota credito) */
const ESTADOS_VALIDOS = ['pendiente', 'enviada', 'rechazada'];

/** Estados por los que se puede filtrar el listado */
const ESTADOS_FILTRO = [...ESTADOS_VALIDOS, 'anulada'];

/** Medios de pago aceptados en una venta */
const MEDIOS_PAGO = ['efectivo', 'tarjeta', 'transferencia', 'credito'];

/** Longitud minima del motivo de una nota credito */
const MOTIVO_MINIMO = 5;

/** Estados de firma de la factura */
const FIRMA_ESTADOS = ['pendiente', 'firmada', 'rechazada'];

/** Tarifa de IVA usada por el sistema */
const IVA_TARIFA = 0.19;

/** Columnas base de una factura (para los SELECT repetidos) */
const CAMPOS_FACTURA = `f.id, f.numero, f.fecha, f.cliente_id, f.cliente_identificacion,
            f.cliente_nombre, f.subtotal, f.iva, f.descuento, f.total, f.estado, f.cufe,
            f.firma_estado, f.intentos_dian, f.correo_enviado,
            f.medio_pago, f.plazo_dias, f.fecha_vencimiento`;

/**
 * GET /api/facturas
 * Lista las facturas emitidas con filtros opcionales:
 *  - estado: filtra por estado DIAN.
 *  - q: busqueda por numero de factura o nombre del cliente.
 *  - pagina / limite: paginacion de resultados.
 */
const listFacturas = asyncHandler(async (req, res) => {
  const { q = '', estado = '', pagina = 1, limite = 20 } = req.query;

  const condiciones = [];
  const parametros = [];

  if (estado && ESTADOS_FILTRO.includes(estado)) {
    condiciones.push('f.estado = ?');
    parametros.push(estado);
  }
  if (q.trim()) {
    condiciones.push('(f.numero LIKE ? OR f.cliente_nombre LIKE ?)');
    const termino = `%${q.trim()}%`;
    parametros.push(termino, termino);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM facturas f
       ${where}`,
    parametros
  );

  const [rows] = await pool.query(
    `SELECT ${CAMPOS_FACTURA}
       FROM facturas f
       ${where}
      ORDER BY f.fecha DESC
      LIMIT ? OFFSET ?`,
    [...parametros, Number(limite), (Number(pagina) - 1) * Number(limite)]
  );

  const total = Number(countRows[0].total);

  res.json({
    success: true,
    total,
    totalPaginas: Math.ceil(total / Number(limite)),
    facturas: rows.map(mapFacturaRow),
  });
});

/**
 * GET /api/facturas/:id
 * Devuelve una factura completa incluyendo sus items.
 */
const getFactura = asyncHandler(async (req, res) => {
  const [facturas] = await pool.query(
    `SELECT ${CAMPOS_FACTURA}
       FROM facturas f
      WHERE f.id = ?`,
    [req.params.id]
  );

  if (facturas.length === 0) {
    throw createHttpError(404, 'Factura no encontrada.');
  }

  const [items] = await pool.query(
    `SELECT producto_id, codigo, nombre, cantidad, precio_unitario, iva, subtotal
       FROM factura_items
      WHERE factura_id = ?
      ORDER BY id ASC`,
    [req.params.id]
  );

  res.json({
    success: true,
    factura: { ...mapFacturaRow(facturas[0]), items: items.map(mapItemRow) },
  });
});

/**
 * POST /api/facturas
 * Finaliza una venta y genera la factura.
 * Body: {
 *   clienteId,
 *   items: [{ productoId, cantidad }],
 *   descuento: number (0-100),
 *   medioPago: 'efectivo' | 'tarjeta' | 'transferencia' | 'credito',
 *   plazoDias: number (solo ventas a credito, 0-365)
 * }
 *
 * Todo el tramo critico ocurre en una sola transaccion:
 *  1. Se bloquean las filas de los productos (SELECT ... FOR UPDATE) y se
 *     valida el stock contra lo que hay en ese instante: dos ventas
 *     simultaneas del mismo producto no pueden sobrevender.
 *  2. Se toma el consecutivo de la tabla `consecutivos` con un upsert
 *     atomico, de modo que no se repite un numero aunque se borren filas.
 *  3. Se insertan factura e items y se descuenta el stock; si algo falla,
 *     la transaccion revierte completa (incluido el consecutivo).
 */
const createFactura = asyncHandler(async (req, res) => {
  const {
    clienteId,
    items = [],
    descuento = 0,
    medioPago = 'efectivo',
    plazoDias = 0,
  } = req.body || {};

  // ---- Validacion de la peticion ----
  if (!isValidPositiveInt(clienteId)) {
    throw createHttpError(400, 'Debe indicar un clienteId valido.');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, 'Debe incluir al menos un item en la venta.');
  }
  if (!MEDIOS_PAGO.includes(medioPago)) {
    throw createHttpError(
      400,
      `Medio de pago invalido. Valores permitidos: ${MEDIOS_PAGO.join(', ')}.`
    );
  }

  const descuentoValido = Number.isFinite(Number(descuento))
    ? Math.min(Math.max(Number(descuento), 0), 100)
    : 0;

  // Solo las ventas a credito manejan plazo; el resto es de contado
  const esCredito = medioPago === 'credito';
  const plazo = esCredito ? Math.min(Math.max(Number(plazoDias) || 0, 0), 365) : 0;
  const vencimiento = esCredito && plazo > 0
    ? new Date(Date.now() + plazo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : null;

  const ids = items.map((i) => Number(i.productoId)).filter((id) => isValidPositiveInt(id));
  if (ids.length !== items.length) {
    throw createHttpError(400, 'Cada item debe incluir un productoId valido.');
  }

  // ---- Cliente (solo lectura, no necesita bloqueo) ----
  const [clientes] = await pool.query(
    'SELECT id, identificacion, nombre, email FROM clientes WHERE id = ? AND activo = 1',
    [clienteId]
  );
  if (clientes.length === 0) {
    throw createHttpError(404, 'Cliente no encontrado.');
  }
  const cliente = clientes[0];

  const placeholders = ids.map(() => '?').join(', ');

  const connection = await pool.getConnection();
  let factura = null;
  let numero = null;
  let facturaId = null;

  try {
    await connection.beginTransaction();

    // ---- Productos con bloqueo de fila ----
    const [productos] = await connection.query(
      `SELECT id, codigo, nombre, precio, iva, stock
         FROM productos
        WHERE id IN (${placeholders}) AND activo = 1
        FOR UPDATE`,
      ids
    );

    if (productos.length !== ids.length) {
      throw createHttpError(400, 'Uno o mas productos no existen o estan inactivos.');
    }
    const productoPorId = new Map(productos.map((p) => [p.id, p]));

    // ---- Cantidad total por producto (un producto puede venir en dos lineas) ----
    const cantidades = new Map();
    for (const item of items) {
      const id = Number(item.productoId);
      const cantidad = Number(item.cantidad);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw createHttpError(
          400,
          `La cantidad del producto ${productoPorId.get(id).nombre} debe ser un entero positivo.`
        );
      }
      cantidades.set(id, (cantidades.get(id) || 0) + cantidad);
    }

    const lineas = [...cantidades.entries()].map(([id, cantidad]) => {
      const producto = productoPorId.get(id);
      if (cantidad > producto.stock) {
        throw createHttpError(
          409,
          `Stock insuficiente de ${producto.nombre}: disponible ${producto.stock}.`
        );
      }
      const subtotal = Number(producto.precio) * cantidad;
      return {
        productoId: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        cantidad,
        precioUnitario: Number(producto.precio),
        iva: calcularIVA(subtotal),
        subtotal: Math.round(subtotal),
      };
    });

    // ---- Totales (descuento porcentual sobre el subtotal) ----
    const subtotalTotal = lineas.reduce((sum, l) => sum + l.subtotal, 0);
    const montoDescuento = Math.round(subtotalTotal * (descuentoValido / 100));
    const baseGravable = subtotalTotal - montoDescuento;
    const ivaTotal = Math.round(baseGravable * IVA_TARIFA);
    const total = baseGravable + ivaTotal;

    // ---- Consecutivo y CUNE dentro de la transaccion ----
    numero = await generarNumeroFactura(connection);
    const cufe = generarCUNE({
      numero,
      clienteId: cliente.id,
      clienteNit: cliente.identificacion,
      total,
      fecha: new Date(),
    });

    const [result] = await connection.query(
      `INSERT INTO facturas
        (numero, fecha, cliente_id, cliente_identificacion, cliente_nombre,
         subtotal, iva, descuento, total, medio_pago, plazo_dias, fecha_vencimiento,
         estado, cufe, firma_estado, intentos_dian, correo_enviado)
       VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, 'pendiente', 0, 0)`,
      [
        numero,
        cliente.id,
        cliente.identificacion,
        cliente.nombre,
        subtotalTotal,
        ivaTotal,
        montoDescuento,
        total,
        medioPago,
        plazo,
        vencimiento,
        cufe,
      ]
    );
    facturaId = result.insertId;

    for (const linea of lineas) {
      await connection.query(
        `INSERT INTO factura_items
          (factura_id, producto_id, codigo, nombre, cantidad, precio_unitario, iva, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          facturaId,
          linea.productoId,
          linea.codigo,
          linea.nombre,
          linea.cantidad,
          linea.precioUnitario,
          linea.iva,
          linea.subtotal,
        ]
      );

      await connection.query(
        'UPDATE productos SET stock = stock - ? WHERE id = ?',
        [linea.cantidad, linea.productoId]
      );
    }

    // Recuperar la factura completa antes de cerrar la transaccion
    const [facturas] = await connection.query(
      `SELECT ${CAMPOS_FACTURA}
         FROM facturas f WHERE f.id = ?`,
      [facturaId]
    );
    const [itemsFactura] = await connection.query(
      `SELECT producto_id, codigo, nombre, cantidad, precio_unitario, iva, subtotal
         FROM factura_items WHERE factura_id = ?`,
      [facturaId]
    );

    await connection.commit();

    factura = { ...mapFacturaRow(facturas[0]), items: itemsFactura.map(mapItemRow) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  res.status(201).json({
    success: true,
    message: `Venta finalizada: ${numero}`,
    factura,
  });

  // ---- Procesos post-venta (no bloquean la respuesta) ----
  try {
    const [empresas] = await pool.query(
      'SELECT nit, razon_social, telefono, email_facturacion, resolucion_dian FROM empresa WHERE id = 1'
    );
    const empresa = empresas[0] || null;

    let pdfBytes = null;
    if (empresa) {
      pdfBytes = await pdfService
        .generarPdfFactura({ factura: { ...factura, items: undefined }, items: factura.items, empresa })
        .catch((err) => {
          registrarError(`No se pudo generar el PDF de la factura ${numero}: ${err.message}`, 'otro', facturaId);
          return null;
        });
    }

    if (pdfBytes && cliente.email && emailService.correoConfigurado()) {
      const enviado = await emailService
        .enviarFactura({
          destino: cliente.email,
          asunto: `Factura ${factura.numero}`,
          cuerpoHtml: `<p>Hola <strong>${factura.cliente.nombre}</strong>,</p>
            <p>Adjuntamos su factura <strong>${factura.numero}</strong> por un valor de
            <strong>$${Number(factura.total).toLocaleString('es-CO')}</strong>.</p>
            <p>Gracias por su compra.</p>`,
          pdfBytes,
          nombreAdjunto: `${factura.numero}.pdf`,
        })
        .catch((err) => {
          registrarError(`Fallo el envio de correo de la factura ${numero}: ${err.message}`, 'correo', facturaId);
          return false;
        });
      if (enviado) {
        await pool.query('UPDATE facturas SET correo_enviado = 1 WHERE id = ?', [facturaId]);
      }
    }

    await registrarAuditoria(req, `INSERT factura ${numero}`, 'facturas', facturaId);
  } catch (error) {
    registrarError(`Error en procesos post-venta de la factura ${numero}: ${error.message}`, 'dian', facturaId);
  }
});

/**
 * PUT /api/facturas/:id/estado
 * Actualiza el estado DIAN de una factura (pendiente -> enviada ->
 * rechazada). Body: { estado }.
 */
const updateEstadoFactura = asyncHandler(async (req, res) => {
  const { estado } = req.body || {};

  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw createHttpError(400, `Estado invalido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}.`);
  }

  const [actual] = await pool.query(
    'SELECT id, numero, estado FROM facturas WHERE id = ?',
    [req.params.id]
  );
  if (actual.length === 0) {
    throw createHttpError(404, 'Factura no encontrada.');
  }

  const factura = actual[0];

  // Una factura anulada es definitiva: solo otra nota credito podria revertirla
  if (factura.estado === 'anulada') {
    throw createHttpError(
      409,
      `La factura ${factura.numero} esta anulada y no puede cambiar de estado.`
    );
  }

  let firmaEstado = factura.firma_estado;
  let intentosDian = factura.intentos_dian;

  // Simulacion del flujo DIAN: cada cambio suma un intento y ajusta la firma
  if (estado === 'enviada') {
    intentosDian = Number(intentosDian || 0) + 1;
    firmaEstado = 'firmada';
  } else if (estado === 'rechazada') {
    firmaEstado = 'rechazada';
  } else {
    firmaEstado = 'pendiente';
  }

  await pool.query(
    `UPDATE facturas
        SET estado = ?, firma_estado = ?, intentos_dian = ?
      WHERE id = ?`,
    [estado, firmaEstado, intentosDian, req.params.id]
  );

  await registrarAuditoria(req, `UPDATE factura ${factura.numero} estado=${estado}`, 'facturas', req.params.id);

  const [rows] = await pool.query(
    `SELECT ${CAMPOS_FACTURA}
       FROM facturas f WHERE f.id = ?`,
    [req.params.id]
  );

  res.json({
    success: true,
    message: `Factura ${factura.numero} marcada como "${estado}".`,
    factura: mapFacturaRow(rows[0]),
  });
});

/**
 * DELETE /api/facturas/:id
 * Las facturas no se eliminan: se anulan con una nota credito.
 * La ruta se conserva para responder con una explicacion en lugar de
 * dejar un 404 que invite a intentarlo por otra via.
 */
const deleteFactura = asyncHandler(async (req, res) => {
  const [actual] = await pool.query(
    'SELECT id, numero FROM facturas WHERE id = ?',
    [req.params.id]
  );
  if (actual.length === 0) {
    throw createHttpError(404, 'Factura no encontrada.');
  }

  await registrarAuditoria(
    req,
    `RECHAZO borrado de factura ${actual[0].numero}`,
    'facturas',
    req.params.id
  );

  throw createHttpError(
    409,
    `La factura ${actual[0].numero} no se elimina: emita una nota credito para anularla.`
  );
});

/**
 * POST /api/facturas/:id/nota-credito
 * Anula una factura emitida. Body: { motivo }.
 *
 * En una transaccion:
 *  1. Bloquea la factura y comprueba que no este ya anulada.
 *  2. Toma un consecutivo propio de notas credito (NC-YYYYMM-00001).
 *  3. Devuelve al inventario el stock de cada item.
 *  4. Inserta la nota y marca la factura como 'anulada'.
 * La factura y sus items se conservan siempre: es el rastro fiscal.
 */
const anularFactura = asyncHandler(async (req, res) => {
  const { motivo } = req.body || {};

  if (!isRequiredString(motivo) || String(motivo).trim().length < MOTIVO_MINIMO) {
    throw createHttpError(
      400,
      `Indique el motivo de la anulacion (minimo ${MOTIVO_MINIMO} caracteres).`
    );
  }

  const connection = await pool.getConnection();
  let nota = null;
  let factura = null;

  try {
    await connection.beginTransaction();

    const [facturas] = await connection.query(
      `SELECT id, numero, estado, subtotal, iva, total
         FROM facturas WHERE id = ? FOR UPDATE`,
      [req.params.id]
    );
    if (facturas.length === 0) {
      throw createHttpError(404, 'Factura no encontrada.');
    }

    const actual = facturas[0];
    if (actual.estado === 'anulada') {
      throw createHttpError(409, `La factura ${actual.numero} ya esta anulada.`);
    }

    const numero = await generarNumeroFactura(connection, 'NC');

    // La mercancia vuelve al inventario
    const [items] = await connection.query(
      'SELECT producto_id, cantidad FROM factura_items WHERE factura_id = ? AND producto_id IS NOT NULL',
      [actual.id]
    );
    for (const item of items) {
      await connection.query(
        'UPDATE productos SET stock = stock + ? WHERE id = ?',
        [item.cantidad, item.producto_id]
      );
    }

    const [result] = await connection.query(
      `INSERT INTO notas_credito
        (factura_id, numero, fecha, motivo, subtotal, iva, total, usuario_id)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)`,
      [
        actual.id,
        numero,
        String(motivo).trim(),
        actual.subtotal,
        actual.iva,
        actual.total,
        req.usuario ? req.usuario.id : null,
      ]
    );

    await connection.query("UPDATE facturas SET estado = 'anulada' WHERE id = ?", [actual.id]);

    const [notas] = await connection.query(
      `SELECT id, numero, fecha, motivo, subtotal, iva, total
         FROM notas_credito WHERE id = ?`,
      [result.insertId]
    );
    const [facturasActualizadas] = await connection.query(
      `SELECT ${CAMPOS_FACTURA} FROM facturas f WHERE f.id = ?`,
      [actual.id]
    );

    await connection.commit();

    nota = {
      ...notas[0],
      subtotal: Number(notas[0].subtotal),
      iva: Number(notas[0].iva),
      total: Number(notas[0].total),
      fecha: notas[0].fecha instanceof Date ? notas[0].fecha.toISOString() : notas[0].fecha,
    };
    factura = mapFacturaRow(facturasActualizadas[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await registrarAuditoria(
    req,
    `NOTA CREDITO ${nota.numero} sobre factura ${factura.numero} (${nota.motivo})`,
    'notas_credito',
    nota.id
  );

  res.status(201).json({
    success: true,
    message: `Factura ${factura.numero} anulada con la nota credito ${nota.numero}.`,
    nota,
    factura,
  });
});

/**
 * GET /api/facturas/:id/notas-credito
 * Notas credito asociadas a una factura (normalmente cero o una).
 */
const getNotasCredito = asyncHandler(async (req, res) => {
  const [facturas] = await pool.query('SELECT id FROM facturas WHERE id = ?', [req.params.id]);
  if (facturas.length === 0) {
    throw createHttpError(404, 'Factura no encontrada.');
  }

  const [notas] = await pool.query(
    `SELECT nc.id, nc.numero, nc.fecha, nc.motivo, nc.subtotal, nc.iva, nc.total,
            u.nombre AS usuario
       FROM notas_credito nc
       LEFT JOIN usuarios u ON u.id = nc.usuario_id
      WHERE nc.factura_id = ?
      ORDER BY nc.id DESC`,
    [req.params.id]
  );

  res.json({
    success: true,
    notas: notas.map((n) => ({
      ...n,
      subtotal: Number(n.subtotal),
      iva: Number(n.iva),
      total: Number(n.total),
      fecha: n.fecha instanceof Date ? n.fecha.toISOString() : n.fecha,
    })),
  });
});

/**
 * GET /api/facturas/:id/pdf
 * Genera el PDF de la factura (Documento Soporte en papel DIAN).
 */
const getFacturaPDF = asyncHandler(async (req, res) => {
  const [facturas] = await pool.query(
    `SELECT ${CAMPOS_FACTURA}
       FROM facturas f WHERE f.id = ?`,
    [req.params.id]
  );
  if (facturas.length === 0) {
    throw createHttpError(404, 'Factura no encontrada.');
  }

  const [items] = await pool.query(
    `SELECT producto_id, codigo, nombre, cantidad, precio_unitario, iva, subtotal
       FROM factura_items WHERE factura_id = ?`,
    [req.params.id]
  );

  const [empresas] = await pool.query(
    'SELECT nit, razon_social, telefono, email_facturacion, resolucion_dian FROM empresa WHERE id = 1'
  );
  const empresa = empresas[0] || null;
  if (!empresa) {
    throw createHttpError(500, 'No hay empresa configurada para facturar.');
  }

  const factura = mapFacturaRow(facturas[0]);

  const pdfBuffer = await pdfService.generarPdfFactura({
    factura,
    items: items.map(mapItemRow),
    empresa,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${factura.numero}.pdf"`);
  res.send(pdfBuffer);
});

/**
 * GET /api/facturas/:id/xml
 * Representacion XML propia de la factura (Cabecera + Detalles).
 *
 * OJO: esto NO es el XML UBL 2.1 que exige la DIAN. Es una
 * representacion de demostracion para el proyecto; una factura
 * electronica valida requiere UBL 2.1, CUFE real (SHA-384), firma
 * electronica y envio a la DIAN.
 */
const getFacturaXML = asyncHandler(async (req, res) => {
  const [facturas] = await pool.query(
    `SELECT ${CAMPOS_FACTURA}
       FROM facturas f WHERE f.id = ?`,
    [req.params.id]
  );
  if (facturas.length === 0) {
    throw createHttpError(404, 'Factura no encontrada.');
  }

  const [items] = await pool.query(
    `SELECT nombre, cantidad, precio_unitario, subtotal, iva
       FROM factura_items WHERE factura_id = ?`,
    [req.params.id]
  );

  const factura = facturas[0];
  const fecha = factura.fecha instanceof Date
    ? factura.fecha.toISOString().slice(0, 19).replace('T', ' ')
    : factura.fecha;

  const detalle = items
    .map(
      (item) => `  <Detalle>
    <Nombre>${escapeXML(item.nombre)}</Nombre>
    <Cantidad>${item.cantidad}</Cantidad>
    <PrecioUnitario>${Number(item.precio_unitario)}</PrecioUnitario>
    <Subtotal>${Number(item.subtotal)}</Subtotal>
    <IVA>${Number(item.iva)}</IVA>
  </Detalle>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FacturaElectronica xmlns="http://www.dian.gov.co/schemas/factura/v2">
  <Cabecera>
    <IdFactura>${escapeXML(factura.numero)}</IdFactura>
    <FechaEmision>${escapeXML(fecha)}</FechaEmision>
    <ClienteId>${Number(factura.cliente_id)}</ClienteId>
    <ClienteNombre>${escapeXML(factura.cliente_nombre)}</ClienteNombre>
    <Subtotal>${Number(factura.subtotal)}</Subtotal>
    <Descuento>${Number(factura.descuento)}</Descuento>
    <Total>${Number(factura.total)}</Total>
    <Estado>${escapeXML(factura.estado)}</Estado>
    <MedioPago>${escapeXML(factura.medio_pago || 'efectivo')}</MedioPago>
    <Referencia>${escapeXML(factura.cufe)}</Referencia>
  </Cabecera>
  <Detalles>
${detalle}
  </Detalles>
</FacturaElectronica>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${factura.numero}.xml"`);
  res.send(xml);
});

/**
 * GET /api/facturas/:id/csv
 * Genera un archivo CSV con la factura y sus items (reporte).
 */
const getFacturaCSV = asyncHandler(async (req, res) => {
  const [facturas] = await pool.query(
    `SELECT numero, fecha, cliente_identificacion, cliente_nombre, subtotal, iva, descuento, total, estado
       FROM facturas WHERE id = ?`,
    [req.params.id]
  );
  if (facturas.length === 0) {
    throw createHttpError(404, 'Factura no encontrada.');
  }

  const [items] = await pool.query(
    `SELECT nombre, cantidad, precio_unitario, subtotal FROM factura_items WHERE factura_id = ?`,
    [req.params.id]
  );

  const f = facturas[0];
  const fecha = f.fecha instanceof Date ? f.fecha.toISOString() : f.fecha;
  const filas = [
    ['Numero Factura', f.numero],
    ['Fecha', fecha],
    ['Cliente', f.cliente_nombre],
    ['NIT', f.cliente_identificacion],
    ['Estado', f.estado],
    ['Subtotal', Number(f.subtotal)],
    ['IVA', Number(f.iva)],
    ['Descuento', Number(f.descuento)],
    ['Total', Number(f.total)],
    [],
    ['Producto', 'Cantidad', 'Precio Unitario', 'Subtotal'],
    ...items.map((i) => [i.nombre, i.cantidad, Number(i.precio_unitario), Number(i.subtotal)]),
  ];

  const csv = filas
    .map((fila) => fila.map((celda) => escapeCSV(celda)).join(','))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${f.numero}.csv"`);
  res.send(csv);
});

module.exports = {
  listFacturas,
  getFactura,
  createFactura,
  updateEstadoFactura,
  deleteFactura,
  anularFactura,
  getNotasCredito,
  getFacturaPDF,
  getFacturaXML,
  getFacturaCSV,
};
