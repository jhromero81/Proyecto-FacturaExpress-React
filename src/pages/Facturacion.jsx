/**
 * Facturacion.js
 * Modulo de facturacion electronica.
 * Muestra historial de facturas emitidas con busqueda, filtros,
 * paginacion, exportacion (PDF, XML, CSV), gestion de estado DIAN
 * y eliminacion de facturas pendientes.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import useDebounce from '../hooks/useDebounce';
import { formatMoney, formatDate } from '../utils/formatters';
import {
  getFacturas,
  getFactura,
  getFacturaXML,
  getFacturaPDF,
  updateFacturaEstado,
  anularFactura,
  getNotasCredito,
} from '../services/api';
import { ROUTES, FACTURA_ESTADOS } from '../utils/constants';

import { useToast } from '../components/common/Toast';
import useDialog from '../hooks/useDialog';
import './Facturacion.css';

/** Cantidad de facturas por pagina (misma que la version Angular) */
const ITEMS_PER_PAGE = 10;

/** Tope de filas que se piden al servidor al exportar un reporte */
const LIMITE_EXPORTACION = 1000;

/** Etiqueta legible de un estado */
const estadoLabel = (estado) => estado.charAt(0).toUpperCase() + estado.slice(1);

/** Etiqueta legible del medio de pago */
const MEDIO_PAGO_LABEL = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  credito: 'Credito',
};

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

  /** Factura seleccionada para el modal de detalle */
  const [selected, setSelected] = useState(null);

  /** Estado de carga del detalle */
  const [detailLoading, setDetailLoading] = useState(false);

  /** Comportamiento accesible del modal de detalle de factura */
  const detailDialogProps = useDialog(Boolean(selected), () => setSelected(null));

  /** Factura que se va a anular con nota credito */
  const [facturaAAnular, setFacturaAAnular] = useState(null);

  /** Motivo que escribe el usuario en el modal de anulacion */
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  /** Envio de la anulacion en curso */
  const [anulando, setAnulando] = useState(false);

  /** Notas credito de la factura abierta en el detalle */
  const [notas, setNotas] = useState([]);

  /** Comportamiento accesible del modal de anulacion */
  const anularDialogProps = useDialog(Boolean(facturaAAnular), () => {
    setFacturaAAnular(null);
    setMotivoAnulacion('');
  });

  const queryClient = useQueryClient();

  /** Busqueda con retardo: una peticion por pausa, no por tecla */
  const debouncedSearch = useDebounce(searchTerm, 350);

  /**
   * Listado paginado EN EL SERVIDOR.
   * La API entrega solo la pagina pedida mas el total real, asi el paginador
   * nunca miente y no se pierden facturas por encima del limite de una
   * respuesta unica (antes se pedian 500 y se paginaba en memoria).
   */
  const { data, isLoading } = useQuery({
    queryKey: ['facturas', { q: debouncedSearch.trim(), estado: statusFilter, pagina: currentPage }],
    queryFn: () =>
      getFacturas({
        q: debouncedSearch.trim(),
        estado: statusFilter === 'todos' ? '' : statusFilter,
        pagina: currentPage,
        limite: ITEMS_PER_PAGE,
      }),
    placeholderData: keepPreviousData,
  });

  /** Facturas de la pagina actual */
  const facturas = data?.facturas ?? [];
  /** Paginas totales segun el servidor */
  const totalPages = data?.totalPaginas ?? 1;
  /** Estado de carga del historial */
  const loading = isLoading;

  /** Al cambiar busqueda o filtro se vuelve a la primera pagina */
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  /** Cambia la pagina actual */
  const goToPage = useCallback((page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  /**
   * Abre el modal de detalle cargando la factura completa desde la API.
   */
  const openDetail = useCallback(async (factura) => {
    setSelected(factura);
    setNotas([]);
    setDetailLoading(true);
    try {
      const res = await getFactura(factura.id);
      setSelected(res.factura);

      // Si la factura esta anulada, se muestra la nota credito que la anulo
      if (res.factura.estado === 'anulada') {
        const resNotas = await getNotasCredito(factura.id).catch(() => ({ notas: [] }));
        setNotas(resNotas.notas || []);
      }
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
      if (selected?.id === factura.id) {
        setSelected((prev) => ({ ...prev, ...res.factura }));
      }
      // La tabla se refresca desde el servidor: el estado y el orden son suyos
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [queryClient, selected, showToast]);

  /**
   * Anula una factura emitiendo una nota credito.
   * No se borra nada: la factura queda marcada como anulada, la nota
   * conserva el motivo y el stock vuelve al inventario en el servidor.
   */
  const handleAnular = useCallback(async (evento) => {
    evento?.preventDefault?.();
    if (!facturaAAnular) return;

    const motivo = motivoAnulacion.trim();
    if (motivo.length < 5) {
      showToast('Indique el motivo de la anulacion (minimo 5 caracteres).', 'error');
      return;
    }

    setAnulando(true);
    try {
      const res = await anularFactura(facturaAAnular.id, motivo);
      showToast(res.message || 'Factura anulada', 'success');
      setFacturaAAnular(null);
      setMotivoAnulacion('');
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAnulando(false);
    }
  }, [facturaAAnular, motivoAnulacion, queryClient, showToast]);

  /**
   * Exporta como CSV todas las facturas que cumplen el filtro actual.
   * Consulta al servidor en lugar de usar la pagina visible: el reporte
   * incluye lo que el usuario filtro, no solo las diez filas de pantalla.
   */
  const exportCSV = useCallback(async () => {
    let filas;
    try {
      const res = await getFacturas({
        q: debouncedSearch.trim(),
        estado: statusFilter === 'todos' ? '' : statusFilter,
        pagina: 1,
        limite: LIMITE_EXPORTACION,
      });
      filas = res.facturas || [];
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }

    if (filas.length === 0) {
      showToast('No hay facturas para exportar', 'warning');
      return;
    }

    const headers = ['Numero Factura', 'Fecha', 'Cliente', 'NIT', 'Estado', 'CUNE', 'Total'];
    const rows = filas.map((f) => [
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
  }, [debouncedSearch, statusFilter, showToast]);

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
            {['todos', 'pendiente', 'enviada', 'rechazada', 'anulada'].map((status) => (
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
            ) : facturas.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-table">
                  <span className="material-icons">receipt_long</span>
                  <p>No se encontraron facturas</p>
                </td>
              </tr>
            ) : (
              facturas.map((factura) => (
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
                      {/* Una factura anulada ya no cambia de estado */}
                      {factura.estado !== 'anulada' && (
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
                      )}
                      {factura.estado !== 'anulada' && (
                        <button
                          className="doc-btn del"
                          onClick={() => {
                            setFacturaAAnular(factura);
                            setMotivoAnulacion('');
                          }}
                          title="Anular con nota credito"
                        >
                          <span className="material-icons">undo</span>
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
          <div className="modal-content modal-wide" {...detailDialogProps} onClick={(e) => e.stopPropagation()}>
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
                      <span className="detail-label">Medio de pago</span>
                      <span>
                        {MEDIO_PAGO_LABEL[selected.medioPago] || 'Efectivo'}
                        {selected.medioPago === 'credito' && selected.plazoDias
                          ? ` (${selected.plazoDias} dias)`
                          : ''}
                      </span>
                    </div>
                  </div>

                  <div className="detail-meta">
                    <div>
                      <span className="detail-label">Envio simulado</span>
                      <span className="font-mono">{selected.intentosDian}</span>
                    </div>
                    <div>
                      <span className="detail-label">Correo enviado</span>
                      <span>{selected.correoEnviado ? 'Si' : 'No'}</span>
                    </div>
                    <div>
                      <span className="detail-label">Referencia interna</span>
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

                  {notas.length > 0 && (
                    <div className="nota-credito-info">
                      <span className="material-icons">undo</span>
                      <div>
                        {notas.map((nota) => (
                          <p key={nota.id}>
                            Anulada con la nota credito <strong className="font-mono">{nota.numero}</strong>
                            {' — '}
                            {nota.motivo}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

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
              {/* Estado definitivo tras la nota credito: no se ofrece cambiarlo */}
              {selected.estado !== 'anulada' && (
                <button
                  className="btn-outline-accent btn-sm"
                  onClick={() =>
                    changeEstado(
                      selected,
                      selected.estado === 'pendiente' ? FACTURA_ESTADOS.ENVIADA : FACTURA_ESTADOS.PENDIENTE
                    )
                  }
                  title="Cambiar estado de envio"
                >
                  <span className="material-icons">swap_horiz</span>
                  {selected.estado === 'pendiente' ? 'Marcar Enviada' : 'Marcar Pendiente'}
                </button>
              )}
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

      {/* Anulacion con nota credito: la factura no se borra */}
      {facturaAAnular && (
        <div className="modal-overlay open" {...anularDialogProps}>
          <form className="modal-content modal-anular" onSubmit={handleAnular}>
            <div className="modal-header">
              <h3>Anular factura {facturaAAnular.numero}</h3>
            </div>
            <div className="modal-body">
              <p className="modal-help">
                La factura no se elimina: se emite una nota credito, el stock vuelve al
                inventario y el documento queda marcado como anulado.
              </p>
              <div className="form-group">
                <label htmlFor="motivo-anulacion">Motivo de la anulacion</label>
                <textarea
                  id="motivo-anulacion"
                  rows="3"
                  maxLength={200}
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  placeholder="Ej: el cliente devolvio la mercancia"
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancel-compact"
                onClick={() => {
                  setFacturaAAnular(null);
                  setMotivoAnulacion('');
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-teal"
                disabled={anulando || motivoAnulacion.trim().length < 5}
              >
                <span className="material-icons">undo</span>
                {anulando ? 'Anulando...' : 'Emitir nota credito'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Facturacion;
