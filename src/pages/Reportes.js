/**
 * Reportes.js
 * Modulo de reportes y estadisticas.
 * Muestra KPIs, grafico de barras por periodo, productos mas vendidos
 * y progreso de meta de ventas mensual.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { formatMoney } from '../utils/formatters';
import { getCollection } from '../services/storageService';
import { META_VENTAS_MENSUAL, PRODUCTOS_DEFAULT } from '../utils/constants';
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
 * Componente Reportes.
 * Dashboard de reportes con estadisticas, grafico de barras y metas.
 */
const Reportes = () => {
  const { showToast } = useToast();

  /** Periodo seleccionado */
  const [periodo, setPeriodo] = useState('mensual');

  /** Facturas cargadas */
  const [facturas] = useState(() => getCollection('facturas'));

  /**
   * Calcula los KPIs del reporte.
   */
  const kpis = useMemo(() => {
    const totalVentas = facturas.reduce((sum, f) => sum + (f.total || 0), 0);
    const totalFacturas = facturas.length;

    // Clientes nuevos (ultimos 30 dias)
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    const clientesNuevos = facturas.filter(
      (f) => f.fecha && new Date(f.fecha) >= hace30Dias
    ).length;

    // Productos vendidos (suma de cantidades)
    const productosVendidos = facturas.reduce((sum, f) => {
      return sum + (f.items || []).reduce((s, item) => s + (item.cantidad || 0), 0);
    }, 0);

    return {
      ventasMes: totalVentas,
      facturasEmitidas: totalFacturas,
      clientesNuevos,
      productosVendidos,
    };
  }, [facturas]);

  /**
   * Datos para el grafico de barras.
   * Muestra ventas del periodo actual vs periodo anterior.
   */
  const chartData = useMemo(() => {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May'];
    return meses.map((mes, i) => ({
      mes,
      actual: [3200000, 4100000, 3800000, 5200000, 4500000][i],
      anterior: [2800000, 3600000, 3500000, 4800000, 4200000][i],
    }));
  }, []);

  /** Valor maximo del grafico */
  const maxChartValue = Math.max(
    ...chartData.flatMap((d) => [d.actual, d.anterior])
  );

  /**
   * Top 3 productos mas vendidos.
   */
  const topProducts = useMemo(() => {
    return PRODUCTOS_DEFAULT.slice(0, 3).map((p, i) => ({
      ...p,
      vendidos: [45, 32, 18][i],
    }));
  }, []);

  /** Porcentaje de avance hacia la meta */
  const goalProgress = Math.min(
    Math.round((kpis.ventasMes / META_VENTAS_MENSUAL) * 100),
    100
  );

  /** Exporta el reporte como CSV */
  const exportReport = useCallback(() => {
    showToast('Reporte PDF en desarrollo (prototipo)', 'info');
  }, [showToast]);

  /**
   * Configuracion de las tarjetas KPI.
   */
  const kpiCards = [
    {
      key: 'ventas',
      label: 'Ventas del Mes',
      value: formatMoney(kpis.ventasMes),
      icon: 'attach_money',
    },
    {
      key: 'facturas',
      label: 'Facturas Emitidas',
      value: kpis.facturasEmitidas,
      icon: 'receipt_long',
    },
    {
      key: 'clientes',
      label: 'Clientes Nuevos',
      value: kpis.clientesNuevos,
      icon: 'person_add',
    },
    {
      key: 'productos',
      label: 'Productos Vendidos',
      value: kpis.productosVendidos,
      icon: 'inventory_2',
    },
  ];

  return (
    <div className="reportes-page">
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
        <button className="btn-outline-accent" onClick={exportReport}>
          <span className="material-icons">picture_as_pdf</span>
          Exportar PDF
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
                const actualHeight = (d.actual / maxChartValue) * 180;
                const anteriorHeight = (d.anterior / maxChartValue) * 180;

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
                Faltan {formatMoney(Math.max(META_VENTAS_MENSUAL - kpis.ventasMes, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reportes;
