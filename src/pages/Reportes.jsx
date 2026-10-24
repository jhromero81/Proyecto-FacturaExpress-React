/**
 * Reportes.js
 * Modulo de reportes y estadisticas.
 * Muestra KPIs, grafico de barras por periodo, productos mas vendidos
 * y progreso de meta de ventas mensual.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { formatMoney, formatDate, formatShortMoney } from '../utils/formatters';
import {
  getKPIs,
  getVentasPeriodo,
  getProductosTop,
  getReportePDF,
  getReportesHistorial,
} from '../services/api';
import { META_VENTAS_MENSUAL } from '../utils/constants';
import { useToast } from '../components/common/Toast';
import useDialog from '../hooks/useDialog';
import './Reportes.css';

/** Periodos disponibles para el reporte */
const PERIODOS = [
  { key: 'semanal', label: 'Semanal' },
  { key: 'mensual', label: 'Mensual' },
  { key: 'trimestral', label: 'Trimestral' },
  { key: 'anual', label: 'Anual' },
];

/**
 * Convierte una etiqueta de periodo (ej: "2026-08", "2026-Q3", "2026")
 * en una abreviatura legible para el grafico.
 * @param {string} periodo - Etiqueta de periodo devuelta por la API.
 * @returns {string} Etiqueta corta.
 */
const periodoLabel = (periodo) => {
  const value = String(periodo || '');
  const [year, month, q] = value.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  if (q && q.startsWith('Q')) return `T${q.slice(1)}`;
  const num = Number(month);
  if (month && !isNaN(num) && num >= 1 && num <= 12) {
    return meses[num - 1] || value;
  }
  if (month) return `S${num}`;
  return year || value;
};

/**
 * Componente Reportes.
 * Dashboard de reportes con estadisticas, grafico de barras y metas.
 */
const Reportes = () => {
  const { showToast } = useToast();

  /** Periodo seleccionado */
  const [periodo, setPeriodo] = useState('mensual');

  /** KPIs obtenidos de la API */
  const [kpis, setKpis] = useState(null);

  /** Ventas por periodo para el grafico */
  const [ventasPeriodo, setVentasPeriodo] = useState([]);

  /** Productos mas vendidos */
  const [topProducts, setTopProducts] = useState([]);

  /** Historial de reportes generados */
  const [historial, setHistorial] = useState([]);

  /** Estado de carga del reporte */
  const [loading, setLoading] = useState(true);

  /** Control del modal de historial */
  const [showHistorial, setShowHistorial] = useState(false);

  /** Estado de generacion del PDF */
  const [exporting, setExporting] = useState(false);

  /** Contenido del tooltip del grafico (o null para ocultarlo) */
  const [tooltip, setTooltip] = useState(null);

  /** Periodo seleccionado al hacer clic en una barra (detalle) */
  const [detailBar, setDetailBar] = useState(null);

  /** Comportamiento accesible de los dos modales de la pagina */
  const detailDialogProps = useDialog(Boolean(detailBar), () => setDetailBar(null));
  const historialDialogProps = useDialog(showHistorial, () => setShowHistorial(false));

  /** Referencia al contenedor del grafico para posicionar el tooltip */
  const chartRef = useRef(null);

  /** Cargar KPIs y productos top desde la API */
  useEffect(() => {
    let mounted = true;

    Promise.all([getKPIs(), getProductosTop(5), getReportesHistorial()])
      .then(([kpisRes, topRes, histRes]) => {
        if (!mounted) return;
        setKpis(kpisRes.kpis || null);
        setTopProducts(topRes.productos || []);
        setHistorial(histRes.reportes || []);
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

  /** Cargar las ventas del periodo seleccionado */
  useEffect(() => {
    let mounted = true;

    setLoading(true);
    getVentasPeriodo(periodo)
      .then((res) => {
        if (mounted) setVentasPeriodo(res.ventas || []);
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
  }, [periodo, showToast]);

  /**
   * Datos para el grafico de barras comparativo.
   * La API entrega el total y las facturas de la ventana actual y
   * de la ventana anterior equivalente para cada periodo.
   */
  const chartData = useMemo(() => {
    return ventasPeriodo.map((v) => ({
      key: v.periodo,
      mes: periodoLabel(v.periodo),
      actual: Number(v.total) || 0,
      facturas: Number(v.facturas) || 0,
      anterior: Number(v.anterior) || 0,
      anteriorFacturas: Number(v.anteriorFacturas) || 0,
    }));
  }, [ventasPeriodo]);

  /** Valor maximo del grafico */
  const maxChartValue = Math.max(
    ...chartData.flatMap((d) => [d.actual, d.anterior]),
    0
  );

  /**
   * Posiciona el tooltip del grafico segun el mouse sobre la barra.
   */
  const handleBarHover = (e, d) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max(e.clientX - rect.left, 100), rect.width - 100);
    setTooltip({
      x,
      y: e.clientY - rect.top,
      ...d,
    });
  };

  /** Porcentaje de avance hacia la meta */
  const goalProgress = Math.min(
    Math.round(((kpis?.ventasMes || 0) / META_VENTAS_MENSUAL) * 100),
    100
  );

  /** Descarga el PDF real del reporte generado por el backend */
  const exportReport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await getReportePDF(periodo);
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || `reporte-ventas-${periodo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Reporte PDF generado correctamente', 'success');
      const hist = await getReportesHistorial();
      setHistorial(hist.reportes || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setExporting(false);
    }
  }, [periodo, showToast]);

  /**
   * Configuracion de las tarjetas KPI.
   */
  const kpiCards = [
    {
      key: 'ventas',
      label: 'Ventas del Mes',
      value: formatMoney(kpis?.ventasMes || 0),
      icon: 'attach_money',
    },
    {
      key: 'facturas',
      label: 'Facturas Emitidas',
      value: kpis?.facturasEmitidas || 0,
      icon: 'receipt_long',
    },
    {
      key: 'clientes',
      label: 'Clientes Nuevos',
      value: kpis?.clientesNuevos || 0,
      icon: 'person_add',
    },
    {
      key: 'productos',
      label: 'Productos Vendidos',
      value: kpis?.productosVendidos || 0,
      icon: 'inventory_2',
    },
  ];

  return (
    <div className="reportes-page">
      {/* Indicador de carga */}
      {loading && (
        <div className="empty-state">
          <span className="material-icons">sync</span>
          <p>Cargando reportes...</p>
        </div>
      )}

      {/* KPIs del reporte */}
      <div className="report-kpi-grid">
        {kpiCards.map((kpi) => (
          <div className="report-kpi" key={kpi.key}>
            <span className="material-icons report-kpi-icon">{kpi.icon}</span>
            <div className="report-kpi-info">
              <div className="report-kpi-value font-mono">{kpi.value}</div>
              <div className="report-kpi-label">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Barra de herramientas */}
      <div className="reportes-toolbar">
        <div className="filter-group">
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              className={`tab-btn ${periodo === p.key ? 'active' : ''}`}
              onClick={() => setPeriodo(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button className="btn-outline-accent" onClick={exportReport} disabled={exporting}>
          <span className="material-icons">picture_as_pdf</span>
          {exporting ? 'Generando...' : 'Exportar PDF'}
        </button>
        <button className="btn-outline-accent" onClick={() => setShowHistorial(true)}>
          <span className="material-icons">history</span>
          Historial
        </button>
      </div>

      {/* Contenido principal: grafico + productos */}
      <div className="reportes-content">
        {/* Grafico de barras comparativo */}
        <div className="content-card">
          <h2 className="card-title">Comparativa de Ventas</h2>
          <div className="chart-container" ref={chartRef}>
            <svg viewBox="0 0 600 280" className="bar-chart">
              {/* Lineas de referencia */}
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={i}
                  x1="50"
                  y1={30 + i * 55}
                  x2="570"
                  y2={30 + i * 55}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
              ))}

              {/* Barras agrupadas */}
              {chartData.map((d, i) => {
                const groupX = 80 + i * 100;
                const barWidth = 30;
                const actualHeight = maxChartValue > 0 ? (d.actual / maxChartValue) * 180 : 0;
                const anteriorHeight = maxChartValue > 0 ? (d.anterior / maxChartValue) * 180 : 0;

                return (
                  <g
                    key={d.key}
                    className="chart-bar-group"
                    onMouseEnter={(e) => handleBarHover(e, d)}
                    onMouseMove={(e) => handleBarHover(e, d)}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => setDetailBar(d)}
                  >
                    {/* Barra periodo anterior (gris) */}
                    <rect
                      className="bar-rect bar-anterior"
                      style={{ animationDelay: `${i * 80}ms` }}
                      x={groupX}
                      y={230 - anteriorHeight}
                      width={barWidth}
                      height={anteriorHeight}
                      rx="4"
                      fill="#b0bec5"
                    />
                    {/* Barra periodo actual (teal) */}
                    <rect
                      className="bar-rect bar-actual"
                      style={{ animationDelay: `${i * 80 + 60}ms` }}
                      x={groupX + barWidth + 4}
                      y={230 - actualHeight}
                      width={barWidth}
                      height={actualHeight}
                      rx="4"
                      fill="var(--accent)"
                    />
                    {/* Valor de la barra anterior */}
                    {d.anterior > 0 && (
                      <text
                        x={groupX + barWidth / 2}
                        y={230 - anteriorHeight - 6}
                        textAnchor="middle"
                        className="chart-value-label"
                      >
                        {formatShortMoney(d.anterior)}
                      </text>
                    )}
                    {/* Valor de la barra actual */}
                    {d.actual > 0 && (
                      <text
                        x={groupX + barWidth + 4 + barWidth / 2}
                        y={230 - actualHeight - 6}
                        textAnchor="middle"
                        className="chart-value-label"
                      >
                        {formatShortMoney(d.actual)}
                      </text>
                    )}
                    {/* Etiqueta del periodo */}
                    <text
                      x={groupX + barWidth + 2}
                      y="255"
                      textAnchor="middle"
                      className="chart-day-label"
                    >
                      {d.mes}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Tooltip al pasar el mouse sobre una barra */}
            {tooltip && (
              <div
                className="chart-tooltip"
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                <div className="chart-tooltip-title">{tooltip.mes}</div>
                <div className="chart-tooltip-row">
                  <span className="legend-dot" style={{ backgroundColor: 'var(--accent)' }} />
                  <span>
                    Actual: <strong>{formatMoney(tooltip.actual)}</strong> ·{' '}
                    {tooltip.facturas} factura(s)
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="legend-dot" style={{ backgroundColor: '#b0bec5' }} />
                  <span>
                    Anterior: <strong>{formatMoney(tooltip.anterior)}</strong> ·{' '}
                    {tooltip.anteriorFacturas} factura(s)
                  </span>
                </div>
                <div className="chart-tooltip-hint">Clic para ver detalle</div>
              </div>
            )}
          </div>

          {/* Leyenda */}
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#b0bec5' }} />
              <span>Periodo Anterior</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: 'var(--accent)' }} />
              <span>Periodo Actual</span>
            </div>
          </div>
        </div>

        {/* Sidebar: productos top + meta de ventas */}
        <div className="reportes-sidebar">
          {/* Productos mas vendidos */}
          <div className="content-card">
            <h2 className="card-title">Productos Mas Vendidos</h2>
            <div className="top-products">
              {topProducts.map((p, i) => (
                <div className="top-product-item" key={p.id}>
                  <span className="product-rank">#{i + 1}</span>
                  <div className="product-details">
                    <span className="product-name">{p.nombre}</span>
                    <span className="product-sold font-mono">
                      {p.vendidos} vendidos
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Meta de ventas mensual */}
          <div className="content-card">
            <h2 className="card-title">Meta de Ventas</h2>
            <div className="sales-goal">
              <div className="goal-progress-text">
                <span className="font-mono goal-percent">{goalProgress}%</span>
                <span className="goal-target">
                  Meta: {formatMoney(META_VENTAS_MENSUAL)}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="determinate"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
              <p className="goal-remaining font-mono">
                Faltan {formatMoney(Math.max(META_VENTAS_MENSUAL - (kpis?.ventasMes || 0), 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de detalle de un periodo del grafico */}
      {detailBar && (
        <div className="modal-overlay open" onClick={() => setDetailBar(null)}>
          <div className="modal-content" {...detailDialogProps} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalle: Periodo {detailBar.mes}</h3>
            </div>
            <div className="modal-body">
              <div className="report-detail-row">
                <div className="report-detail-block">
                  <span className="legend-dot" style={{ backgroundColor: 'var(--accent)' }} />
                  <div>
                    <div className="report-detail-label">Periodo Actual</div>
                    <div className="report-detail-value font-mono">
                      {formatMoney(detailBar.actual)}
                    </div>
                    <div className="report-detail-sub font-mono">
                      {detailBar.facturas} factura(s)
                    </div>
                  </div>
                </div>
                <div className="report-detail-block">
                  <span className="legend-dot" style={{ backgroundColor: '#b0bec5' }} />
                  <div>
                    <div className="report-detail-label">Periodo Anterior</div>
                    <div className="report-detail-value font-mono">
                      {formatMoney(detailBar.anterior)}
                    </div>
                    <div className="report-detail-sub font-mono">
                      {detailBar.anteriorFacturas} factura(s)
                    </div>
                  </div>
                </div>
              </div>
              <p className="report-detail-variation">
                Variacion:{' '}
                <strong>
                  {detailBar.anterior > 0
                    ? `${((detailBar.actual - detailBar.anterior) / detailBar.anterior * 100).toFixed(1)}%`
                    : '--'}
                </strong>
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel-compact" onClick={() => setDetailBar(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de historial de reportes */}
      {showHistorial && (
        <div className="modal-overlay open" onClick={() => setShowHistorial(false)}>
          <div className="modal-content" {...historialDialogProps} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Historial de Reportes</h3>
            </div>
            <div className="modal-body">
              {historial.length === 0 ? (
                <div className="empty-state">
                  <span className="material-icons">history</span>
                  <p>Aun no se han generado reportes</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Archivo</th>
                      <th>Periodo</th>
                      <th>Tamano</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((r) => (
                      <tr key={r.id}>
                        <td className="font-mono">{r.archivo}</td>
                        <td>{r.periodo}</td>
                        <td className="font-mono">{Math.round(r.tamano / 1024)} KB</td>
                        <td>{formatDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel-compact" onClick={() => setShowHistorial(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reportes;
