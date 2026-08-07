/**
 * Facturacion.js
 * Modulo de facturacion electronica.
 * Muestra historial de facturas emitidas con busqueda, filtros,
 * paginacion, exportacion (PDF, XML, CSV), gestion de estado DIAN
 * y eliminacion de facturas pendientes.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMoney, formatDate } from '../utils/formatters';
import {
  getFacturas,
  getFactura,
  getFacturaXML,
  getFacturaPDF,
  updateFacturaEstado,
  deleteFactura,
} from '../services/api';
import { ROUTES, FACTURA_ESTADOS } from '../utils/constants';

import { useToast } from '../components/common/Toast';
import './Facturacion.css';

/** Cantidad de facturas por pagina */
const ITEMS_PER_PAGE = 5;

/** Etiqueta legible de un estado */
const estadoLabel = (estado) => estado.charAt(0).toUpperCase() + estado.slice(1);

/**
 * Componente Facturacion.
 * Tabla paginada con todas las facturas emitidas y acciones de gestion.
 */
const Facturacion = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  /** Texto de busqueda */
  const [searchTerm, setSearchTerm] = useState('');

  /** Pagina actual */
  const [currentPage, setCurrentPage] = useState(1);

  /** Filtro de estado activo */
  const [statusFilter, setStatusFilter] = useState('todos');

  /** Facturas cargadas desde la API */
  const [facturas, setFacturas] = useState([]);

  /** Estado de carga del historial */
  const [loading, setLoading] = useState(true);

  /** Factura seleccionada para el modal de detalle */
  const [selected, setSelected] = useState(null);

  /** Estado de carga del detalle */
  const [detailLoading, setDetailLoading] = useState(false);

  /** Cargar el historial de facturas desde la API */
  useEffect(() => {
    let mounted = true;

    getFacturas({ limite: 500 })
      .then((res) => {
        if (mounted) setFacturas(res.facturas || []);
      })
      .catch((err) => {
        if (mounted) showToast(err.message, 'error');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [showToast]);

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
   * Abre el modal de detalle cargando la factura completa desde la API.
   */
  const openDetail = useCallback(async (factura) => {
    setSelected(factura);
    setDetailLoading(true);
    try {
      const res = await getFactura(factura.id);
      setSelected(res.factura);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

  /**
   * Descarga el PDF real de la factura generado por el backend.
   */
  const downloadPDF = useCallback(async (factura) => {
    try {
      const res = await getFacturaPDF(factura.id);
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || `${factura.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`PDF descargado: ${factura.numero}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  /**
   * Descarga el XML de la factura generado por la API (formato DIAN).
   */
  const downloadXML = useCallback(async (factura) => {
    try {
      const res = await getFacturaXML(factura.id);
      const blob = new Blob([res.text], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || `${factura.numero}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`XML descargado: ${factura.numero}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  /**
   * Actualiza el estado DIAN de una factura.
   */
  const changeEstado = useCallback(async (factura, estado) => {
    try {
      const res = await updateFacturaEstado(factura.id, estado);
      setFacturas((prev) =>
        prev.map((f) => (f.id === factura.id ? res.factura : f))
      );
      if (selected?.id === factura.id) {
        setSelected((prev) => ({ ...prev, ...res.factura }));
      }
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [selected, showToast]);

  /**
   * Elimina una factura pendiente (con confirmacion).
   */
  const handleDelete = useCallback(async (factura) => {
    if (!window.confirm(`Desea eliminar la factura ${factura.numero}?\nEsta accion no se puede deshacer.`)) return;
    try {
      const res = await deleteFactura(factura.id);
      showToast(res.message, 'success');
      setFacturas((prev) => prev.filter((f) => f.id !== factura.id));
      if (selected?.id === factura.id) setSelected(null);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [selected, showToast]);

  /**
   * Exporta todas las facturas filtradas como archivo CSV.
   */
  const exportCSV = useCallback(() => {
    if (filteredFacturas.length === 0) {
      showToast('No hay facturas para exportar', 'warning');
      return;
    }

    const headers = ['Numero Factura', 'Fecha', 'Cliente', 'NIT', 'Estado', 'CUNE', 'Total'];
    const rows = filteredFacturas.map((f) => [
      f.numero,
      formatDate(f.fecha),
      f.cliente?.nombre || '',
      f.cliente?.identificacion || '',
      f.estado,
      f.cufe || '',
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
            {['todos', 'pendiente', 'enviada', 'rechazada'].map((status) => (
              <button
                key={status}
                className={`tab-btn ${statusFilter === status ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
              >
                {status === 'todos' ? 'Todos' : estadoLabel(status)}
              </button>
            ))}
          </div>
          <button className="btn-outline-accent" onClick={exportCSV}>
            <span className="material-icons">download</span>
            Exportar Reporte
          </button>
          <button className="btn-teal" onClick={() => navigate(ROUTES.VENTAS)}>
            <span className="material-icons">add</span>
            Nueva Venta
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
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="empty-table">
                  <span className="material-icons">sync</span>
                  <p>Cargando facturas...</p>
                </td>
              </tr>
            ) : paginatedFacturas.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-table">
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
                      {estadoLabel(factura.estado)}
                    </span>
                  </td>
                  <td className="amount-cell font-mono">{formatMoney(factura.total)}</td>
                  <td>
                    <div className="doc-actions">
                      <button
                        className="doc-btn pdf"
                        onClick={() => downloadPDF(factura)}
                        title="Descargar PDF"
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
                  <td>
                    <div className="doc-actions">
                      <button
                        className="doc-btn view"
                        onClick={() => openDetail(factura)}
                        title="Ver detalle"
                      >
                        <span className="material-icons">visibility</span>
                      </button>
                      <button
                        className="doc-btn change"
                        onClick={() =>
                          changeEstado(
                            factura,
                            factura.estado === 'pendiente' ? FACTURA_ESTADOS.ENVIADA : FACTURA_ESTADOS.PENDIENTE
                          )
                        }
                        title={factura.estado === 'pendiente' ? 'Marcar como enviada' : 'Marcar como pendiente'}
                      >
                        <span className="material-icons">swap_horiz</span>
                      </button>
                      {factura.estado !== 'enviada' && (
                        <button
                          className="doc-btn del"
                          onClick={() => handleDelete(factura)}
                          title="Eliminar factura"
                        >
                          <span className="material-icons">delete</span>
                        </button>
                      )}
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

      {/* Modal de detalle de factura */}
      {selected && (
        <div className="modal-overlay open" onClick={() => setSelected(null)}>
          <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Factura {selected.numero}</h3>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <div className="empty-state">
                  <span className="material-icons">sync</span>
                  <p>Cargando detalle...</p>
                </div>
              ) : (
                <>
                  <div className="detail-meta">
                    <div>
                      <span className="detail-label">Fecha</span>
                      <span className="font-mono">{formatDate(selected.fecha)}</span>
                    </div>
                    <div>
                      <span className="detail-label">Cliente</span>
                      <span>{selected.cliente?.nombre}</span>
                    </div>
                    <div>
                      <span className="detail-label">Estado</span>
                      <span className={`badge-status ${selected.estado}`}>
                        {estadoLabel(selected.estado)}
                      </span>
                    </div>
                    <div>
                      <span className="detail-label">Firma</span>
                      <span className={`badge-status ${selected.firmaEstado === 'firmada' ? 'enviada' : selected.firmaEstado}`}>
                        {selected.firmaEstado}
                      </span>
                    </div>
                  </div>

                  <div className="detail-meta">
                    <div>
                      <span className="detail-label">Intentos DIAN</span>
                      <span className="font-mono">{selected.intentosDian}</span>
                    </div>
                    <div>
                      <span className="detail-label">Correo enviado</span>
                      <span>{selected.correoEnviado ? 'Si' : 'No'}</span>
                    </div>
                    <div>
                      <span className="detail-label">CUNE</span>
                      <span className="font-mono cune-text" title={selected.cufe}>
                        {selected.cufe ? `${selected.cufe.slice(0, 24)}...` : 'Pendiente'}
                      </span>
                    </div>
                  </div>

                  <table className="data-table detail-items">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>Precio</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.items || []).map((item, i) => (
                        <tr key={i}>
                          <td>{item.nombre}</td>
                          <td className="font-mono">{item.cantidad}</td>
                          <td className="amount-cell font-mono">{formatMoney(item.precioUnitario)}</td>
                          <td className="amount-cell font-mono">{formatMoney(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="detail-totals">
                    <div><span>Subtotal</span><span className="font-mono">{formatMoney(selected.subtotal)}</span></div>
                    {selected.descuento > 0 && (
                      <div className="detail-discount"><span>Descuento</span><span className="font-mono">-{formatMoney(selected.descuento)}</span></div>
                    )}
                    <div><span>IVA (19%)</span><span className="font-mono">{formatMoney(selected.iva)}</span></div>
                    <div className="detail-total"><span>TOTAL</span><span className="font-mono">{formatMoney(selected.total)}</span></div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-outline-accent btn-sm"
                onClick={() =>
                  changeEstado(
                    selected,
                    selected.estado === 'pendiente' ? FACTURA_ESTADOS.ENVIADA : FACTURA_ESTADOS.PENDIENTE
                  )
                }
                title="Cambiar estado DIAN"
              >
                <span className="material-icons">swap_horiz</span>
                {selected.estado === 'pendiente' ? 'Marcar Enviada' : 'Marcar Pendiente'}
              </button>
              <button
                className="btn-outline-accent btn-sm"
                onClick={() => downloadPDF(selected)}
                title="Descargar PDF"
              >
                <span className="material-icons">picture_as_pdf</span>
                PDF
              </button>
              <button className="btn-cancel-compact" onClick={() => setSelected(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Facturacion;
