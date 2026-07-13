/**
 * Facturacion.js
 * Modulo de facturacion electronica.
 * Muestra historial de facturas emitidas con busqueda, filtros,
 * paginacion y exportacion (PDF, XML, CSV).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { formatMoney, formatDate, escapeHtml } from '../utils/formatters';
import { getCollection } from '../services/storageService';
import { EMPRESA_DEFAULT, APP_VERSION } from '../utils/constants';

import { useToast } from '../components/common/Toast';
import './Facturacion.css';

/** Cantidad de facturas por pagina */
const ITEMS_PER_PAGE = 5;

/**
 * Componente Facturacion.
 * Tabla paginada con todas las facturas emitidas y acciones de exportacion.
 */
const Facturacion = () => {
  const { showToast } = useToast();

  /** Texto de busqueda */
  const [searchTerm, setSearchTerm] = useState('');

  /** Pagina actual */
  const [currentPage, setCurrentPage] = useState(1);

  /** Filtro de estado activo */
  const [statusFilter, setStatusFilter] = useState('todos');

  /** Facturas cargadas del almacenamiento */
  const [facturas] = useState(() => getCollection('facturas'));

  /**
   * Filtra facturas por termino de busqueda y estado.
   */
  const filteredFacturas = useMemo(() => {
    let result = facturas;

    // Filtrar por estado
    if (statusFilter !== 'todos') {
      result = result.filter((f) => f.estado === statusFilter);
    }

    // Filtrar por texto de busqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (f) =>
          (f.numero && f.numero.toLowerCase().includes(term)) ||
          (f.cliente?.nombre && f.cliente.nombre.toLowerCase().includes(term))
      );
    }

    return result;
  }, [facturas, searchTerm, statusFilter]);

  /** Total de paginas */
  const totalPages = Math.ceil(filteredFacturas.length / ITEMS_PER_PAGE);

  /** Facturas de la pagina actual */
  const paginatedFacturas = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredFacturas.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredFacturas, currentPage]);

  /** Cambia la pagina actual */
  const goToPage = useCallback((page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  /**
   * Genera y descarga un archivo XML simplificado de la factura.
   * Simula el formato DIAN de facturacion electronica.
   */
  const downloadXML = useCallback((factura) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="http://www.dian.gov.co/contratos/facturaelectronica/v1">
  <ID>${escapeHtml(factura.numero)}</ID>
  <IssueDate>${escapeHtml(factura.fecha)}</IssueDate>
  <InvoiceTypeCode>01</InvoiceTypeCode>
  <AccountingSupplierParty>
    <NIT>${escapeHtml(EMPRESA_DEFAULT.nit)}</NIT>
    <Name>${escapeHtml(EMPRESA_DEFAULT.razonSocial)}</Name>
  </AccountingSupplierParty>
  <AccountingCustomerParty>
    <NIT>${escapeHtml(factura.cliente?.identificacion || '')}</NIT>
    <Name>${escapeHtml(factura.cliente?.nombre || '')}</Name>
  </AccountingCustomerParty>
  <LegalMonetaryTotal>
    <PayableAmount currencyID="COP">${factura.total}</PayableAmount>
  </LegalMonetaryTotal>
  ${(factura.items || [])
    .map(
      (item) => `<InvoiceLine>
    <Quantity>${item.cantidad}</Quantity>
    <PriceAmount>${item.precioUnitario}</PriceAmount>
    <LineExtensionAmount>${item.subtotal}</LineExtensionAmount>
  </InvoiceLine>`
    )
    .join('\n  ')}
</Invoice>`;

    // Crear y descargar el archivo
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${factura.numero}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`XML descargado: ${factura.numero}`, 'success');
  }, [showToast]);

  /**
   * Abre una vista previa del PDF de la factura en nueva ventana.
   */
  const previewPDF = useCallback((factura) => {
    const pdfContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Factura ${escapeHtml(factura.numero)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    .header { text-align: center; border-bottom: 2px solid #1abc9c; padding-bottom: 20px; margin-bottom: 20px; }
    .header h1 { color: #1abc9c; margin: 0; }
    .header p { color: #666; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #0f1923; color: #1abc9c; padding: 10px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #eee; }
    .total { text-align: right; font-size: 1.2em; font-weight: bold; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; color: #999; font-size: 0.8em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(EMPRESA_DEFAULT.razonSocial)}</h1>
    <p>NIT: ${escapeHtml(EMPRESA_DEFAULT.nit)}</p>
    <p>Factura Electronica: ${escapeHtml(factura.numero)}</p>
    <p>Fecha: ${formatDate(factura.fecha)}</p>
  </div>
  <p><strong>Cliente:</strong> ${escapeHtml(factura.cliente?.nombre || 'N/A')} - ${escapeHtml(factura.cliente?.identificacion || '')}</p>
  <table>
    <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
    <tbody>
      ${(factura.items || [])
        .map(
          (item) => `<tr><td>${escapeHtml(item.nombre)}</td><td>${item.cantidad}</td><td>$${item.precioUnitario?.toLocaleString()}</td><td>$${item.subtotal?.toLocaleString()}</td></tr>`
        )
        .join('')}
    </tbody>
  </table>
  <div class="total">
    <p>Subtotal: $${factura.subtotal?.toLocaleString()}</p>
    <p>IVA (19%): $${factura.iva?.toLocaleString()}</p>
    <p style="color: #1abc9c;">TOTAL: $${factura.total?.toLocaleString()}</p>
  </div>
  <div class="footer">
    <p>FacturaExpress v${APP_VERSION} - Facturacion Electronica DIAN</p>
    <p>Codigo de verificacion: ${Math.random().toString(36).substring(2, 15)}</p>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      showToast('No se pudo abrir la ventana. Verifique que los popups no esten bloqueados.', 'warning');
      return;
    }
    win.document.write(pdfContent);
    win.document.close();
    showToast(`Vista previa abierta: ${factura.numero}`, 'info');
  }, [showToast]);

  /**
   * Exporta todas las facturas filtradas como archivo CSV.
   */
  const exportCSV = useCallback(() => {
    if (filteredFacturas.length === 0) {
      showToast('No hay facturas para exportar', 'warning');
      return;
    }

    const headers = ['Numero Factura', 'Fecha', 'Cliente', 'NIT', 'Estado', 'Total'];
    const rows = filteredFacturas.map((f) => [
      f.numero,
      formatDate(f.fecha),
      f.cliente?.nombre || '',
      f.cliente?.identificacion || '',
      f.estado,
      f.total,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reporte_facturas.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Reporte CSV exportado correctamente', 'success');
  }, [filteredFacturas, showToast]);

  return (
    <div className="facturacion-page">
      {/* Barra de herramientas */}
      <div className="facturacion-toolbar">
        <div className="search-wrapper">
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="Buscar por numero o cliente..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="toolbar-actions">
          <div className="filter-group">
            {['todos', 'enviado', 'pendiente', 'rechazado'].map((status) => (
              <button
                key={status}
                className={`tab-btn ${statusFilter === status ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
              >
                {status === 'todos' ? 'Todos' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn-outline-accent" onClick={exportCSV}>
            <span className="material-icons">download</span>
            Exportar Reporte
          </button>
        </div>
      </div>

      {/* Tabla de facturas */}
      <div className="content-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Numero Factura</th>
              <th>Fecha Emision</th>
              <th>Cliente</th>
              <th>Estado DIAN</th>
              <th>Total</th>
              <th>Documentos</th>
            </tr>
          </thead>
          <tbody>
            {paginatedFacturas.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-table">
                  <span className="material-icons">receipt_long</span>
                  <p>No se encontraron facturas</p>
                </td>
              </tr>
            ) : (
              paginatedFacturas.map((factura) => (
                <tr key={factura.id}>
                  <td className="font-mono">{factura.numero}</td>
                  <td>{formatDate(factura.fecha)}</td>
                  <td>{factura.cliente?.nombre || 'N/A'}</td>
                  <td>
                    <span className={`badge-status ${factura.estado}`}>
                      {factura.estado}
                    </span>
                  </td>
                  <td className="amount-cell font-mono">{formatMoney(factura.total)}</td>
                  <td>
                    <div className="doc-actions">
                      <button
                        className="doc-btn pdf"
                        onClick={() => previewPDF(factura)}
                        title="Ver PDF"
                      >
                        <span className="material-icons">picture_as_pdf</span>
                      </button>
                      <button
                        className="doc-btn xml"
                        onClick={() => downloadXML(factura)}
                        title="Descargar XML"
                      >
                        <span className="material-icons">code</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Paginacion */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <span className="material-icons">chevron_left</span>
            </button>
            <span className="page-info">
              Pagina {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <span className="material-icons">chevron_right</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Facturacion;
