/**
 * Reportes.js
 * Modulo de reportes y estadisticas.
 * Muestra KPIs, grafico de barras por periodo, productos mas vendidos
 * y progreso de meta de ventas mensual.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { formatMoney, formatDate } from '../utils/formatters';
import {
  getKPIs,
  getVentasPeriodo,
  getProductosTop,
  getReportePDF,
  getReportesHistorial,
} from '../services/api';
import { META_VENTAS_MENSUAL } from '../utils/constants';
import { useToast } from '../components/common/Toast';
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
  if (month) {
    const idx = Number(month) - 1;
    return meses[idx] || value;
  }
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
   * Datos para el grafico de barras.
   * La API entrega las ventas del periodo actual; la serie anterior
   * se muestra en cero cuando no hay comparativo disponible.
   */
  const chartData = useMemo(() => {
    return ventasPeriodo.map((v) => ({
      mes: periodoLabel(v.periodo),
      actual: Number(v.total) || 0,
      anterior: 0,
    }));
  }, [ventasPeriodo]);

  /** Valor maximo del grafico */
  const maxChartValue = Math.max(
    ...chartData.flatMap((d) => [d.actual, d.anterior]),
    0
  );

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
          <h3 className="card-title">Comparativa de Ventas</h3>
          <div className="chart-container">
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
                  <g key={d.mes}>
                    {/* Barra periodo anterior (gris) */}
                    <rect
                      x={groupX}
                      y={230 - anteriorHeight}
                      width={barWidth}
                      height={anteriorHeight}
                      rx="4"
                      fill="#b0bec5"
                      opacity="0.7"
                    />
                    {/* Barra periodo actual (teal) */}
                    <rect
                      x={groupX + barWidth + 4}
                      y={230 - actualHeight}
                      width={barWidth}
                      height={actualHeight}
                      rx="4"
                      fill="var(--accent)"
                    />
                    {/* Etiqueta del mes */}
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
            <h3 className="card-title">Productos Mas Vendidos</h3>
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
            <h3 className="card-title">Meta de Ventas</h3>
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

      {/* Modal de historial de reportes */}
      {showHistorial && (
        <div className="modal-overlay open" onClick={() => setShowHistorial(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
