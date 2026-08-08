/**
 * Dashboard.js
 * Panel principal de FacturaExpress.
 * Muestra KPIs del dia, grafico de ventas semanales y ultimas transacciones.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';

import { formatMoney, formatDate, formatShortMoney, timeAgo } from '../utils/formatters';
import {
  getKPIs,
  getVentasSemanales,
  getUltimasTransacciones,
  getProductosTop,
} from '../services/api';
import './Dashboard.css';

/**
 * Devuelve la abreviacion del dia de la semana en espanol.
 * @param {string} fechaStr - Fecha en formato ISO (yyyy-mm-dd).
 * @returns {string} Abreviacion (Lun, Mar, ...).
 */
const shortDay = (fechaStr) => {
  const fecha = new Date(`${fechaStr}T00:00:00`);
  if (isNaN(fecha.getTime())) return '--';
  return ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][fecha.getDay()];
};

/**
 * Componente Dashboard.
 * Muestra KPIs, grafico de ventas semanales y ultimas transacciones
 * obtenidos de la API del backend.
 */
const Dashboard = () => {
  /** Facturas del historial (transacciones recientes) */
  const [transacciones, setTransacciones] = useState([]);

  /** KPIs del negocio */
  const [kpis, setKpis] = useState(null);

  /** Ventas de los ultimos 7 dias */
  const [ventasSemanales, setVentasSemanales] = useState([]);

  /** Productos mas vendidos */
  const [topProducts, setTopProducts] = useState([]);

  /** Estado de carga del panel */
  const [loading, setLoading] = useState(true);

  /** Contenido del tooltip del grafico (o null para ocultarlo) */
  const [tooltip, setTooltip] = useState(null);

  /** Dia seleccionado al hacer clic en una barra (detalle) */
  const [detailBar, setDetailBar] = useState(null);

  /** Referencia al contenedor del grafico para posicionar el tooltip */
  const chartRef = useRef(null);

  /** Cargar los datos del dashboard desde la API */
  useEffect(() => {
    let mounted = true;

    Promise.all([
      getKPIs(),
      getVentasSemanales(),
      getUltimasTransacciones(4),
      getProductosTop(4),
    ])
      .then(([kpisRes, semanalRes, txsRes, topRes]) => {
        if (!mounted) return;
        setKpis(kpisRes.kpis || null);
        setVentasSemanales(semanalRes.ventas || []);
        setTransacciones(txsRes.transacciones || []);
        setTopProducts(topRes.productos || []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Calcula las estadisticas a partir de los KPIs de la API.
   */
  const stats = useMemo(() => {
    const k = kpis || {};
    return {
      ventasDia: { valor: k.ventasDia || 0, variacion: 0 },
      facturasEmitidas: { valor: k.facturasEmitidasHoy || 0, variacion: 0 },
      pendientesDIAN: { valor: k.pendientesDIAN || 0, variacion: 0 },
      ticketPromedio: { valor: k.ticketPromedio || 0, variacion: 0 },
    };
  }, [kpis]);

  /**
   * Datos del grafico de ventas semanales.
   * Se completan los 7 dias de la semana (los dias sin ventas valen 0)
   * para que el grafico muestre la semana completa en orden.
   */
  const chartData = useMemo(() => {
    const byDate = new Map(ventasSemanales.map((v) => [v.dia, v]));
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('-');
      const row = byDate.get(iso);
      dias.push({
        key: iso,
        day: shortDay(iso),
        fecha: iso,
        value: Number(row?.total) || 0,
        facturas: Number(row?.facturas) || 0,
      });
    }
    return dias;
  }, [ventasSemanales]);

  /** Total de ventas de la semana */
  const semanaTotal = useMemo(
    () => chartData.reduce((sum, d) => sum + d.value, 0),
    [chartData]
  );

  /** Dia con mayores ventas de la semana */
  const mejorDia = useMemo(
    () => chartData.reduce((best, d) => (d.value > best.value ? d : best), chartData[0]),
    [chartData]
  );

  /** Ultimas transacciones ordenadas (la API ya las devuelve recientes) */
  const lastTransactions = useMemo(() => {
    return transacciones;
  }, [transacciones]);

  /** Valor maximo del grafico para escalar las barras */
  const maxChartValue = Math.max(...chartData.map((d) => d.value), 0);

  /**
   * Posiciona el tooltip del grafico segun el mouse sobre la barra.
   */
  const handleBarHover = (e, d) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max(e.clientX - rect.left, 95), rect.width - 95);
    const y = Math.max(e.clientY - rect.top, 80);
    setTooltip({
      x,
      y,
      ...d,
    });
  };

  /**
   * Configuracion de las tarjetas KPI.
   */
  const kpiCards = [
    {
      key: 'ventas',
      label: 'Ventas del Dia',
      value: formatMoney(stats.ventasDia.valor),
      icon: 'attach_money',
      variacion: stats.ventasDia.variacion,
    },
    {
      key: 'facturas',
      label: 'Facturas Emitidas',
      value: stats.facturasEmitidas.valor,
      icon: 'receipt_long',
      variacion: stats.facturasEmitidas.variacion,
    },
    {
      key: 'pendientes',
      label: 'Pendientes DIAN',
      value: stats.pendientesDIAN.valor,
      icon: 'pending_actions',
      variacion: stats.pendientesDIAN.variacion,
    },
    {
      key: 'ticket',
      label: 'Ticket Promedio',
      value: formatMoney(stats.ticketPromedio.valor),
      icon: 'speed',
      variacion: stats.ticketPromedio.variacion,
    },
  ];

  return (
    <div className="dashboard">
      {/* Indicador de carga */}
      {loading && (
        <div className="empty-state">
          <span className="material-icons">sync</span>
          <p>Cargando datos del panel...</p>
        </div>
      )}

      {/* Tarjetas KPI */}
      <div className="kpi-grid">
        {kpiCards.map((kpi) => (
          <div className="stat-card" key={kpi.key}>
            <div className="stat-card-header">
              <span className="material-icons stat-icon">{kpi.icon}</span>
              <span className={`stat-variacion ${kpi.variacion >= 0 ? 'positive' : 'negative'}`}>
                <span className="material-icons">
                  {kpi.variacion >= 0 ? 'trending_up' : 'trending_down'}
                </span>
                {Math.abs(kpi.variacion)}%
              </span>
            </div>
            <div className="stat-value font-mono">{kpi.value}</div>
            <div className="stat-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Contenido principal: grafico + transacciones */}
      <div className="dashboard-content">
        {/* Grafico de ventas semanales */}
        <div className="content-card chart-card">
          <h3 className="card-title">Ventas de la Semana</h3>
          <div className="chart-container" ref={chartRef}>
            <svg viewBox="0 0 600 250" className="weekly-chart">
              {/* Definicion del gradiente de relleno */}
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Lineas de referencia horizontales */}
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={i}
                  x1="40"
                  y1={30 + i * 45}
                  x2="580"
                  y2={30 + i * 45}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
              ))}

              {/* Barras del grafico */}
              {chartData.map((d, i) => {
                const barHeight = maxChartValue > 0 ? (d.value / maxChartValue) * 160 : 0;
                const step = 520 / chartData.length;
                const barWidth = 42;
                const center = 60 + i * step + step / 2;
                const x = center - barWidth / 2;
                const y = 210 - barHeight;
                const esMejor = d.value > 0 && d.key === mejorDia?.key;
                return (
                  <g
                    key={d.key}
                    className="chart-bar-group"
                    onMouseEnter={(e) => handleBarHover(e, d)}
                    onMouseMove={(e) => handleBarHover(e, d)}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => setDetailBar(d)}
                  >
                    {/* Barra */}
                    <rect
                      className="bar-rect"
                      style={{ animationDelay: `${i * 60}ms` }}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="6"
                      fill="var(--accent)"
                      opacity={esMejor ? 1 : 0.85}
                    />
                    {/* Valor sobre la barra (solo si hay ventas) */}
                    {d.value > 0 && (
                      <text
                        x={center}
                        y={y - 8}
                        textAnchor="middle"
                        className="chart-value-label"
                      >
                        {formatShortMoney(d.value)}
                      </text>
                    )}
                    {/* Etiqueta del dia */}
                    <text
                      x={center}
                      y="235"
                      textAnchor="middle"
                      className="chart-day-label"
                    >
                      {d.day}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Tooltip al pasar el mouse sobre una barra */}
            {tooltip && (
              <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
                <div className="chart-tooltip-title">
                  {tooltip.day} · {formatDate(tooltip.fecha)}
                </div>
                <div className="chart-tooltip-row">
                  <span className="legend-dot" style={{ backgroundColor: 'var(--accent)' }} />
                  <span>
                    Ventas: <strong>{formatMoney(tooltip.value)}</strong>
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="material-icons">receipt_long</span>
                  <span>{tooltip.facturas} factura(s)</span>
                </div>
                {semanaTotal > 0 && (
                  <div className="chart-tooltip-row">
                    <span className="material-icons">pie_chart</span>
                    <span>{((tooltip.value / semanaTotal) * 100).toFixed(1)}% de la semana</span>
                  </div>
                )}
                <div className="chart-tooltip-hint">Clic para ver detalle</div>
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral: transacciones + productos top */}
        <div className="dashboard-side">
          {/* Lista de ultimas transacciones */}
          <div className="content-card transactions-card">
            <h3 className="card-title">Ultimas Transacciones</h3>
            <div className="transactions-list">
              {lastTransactions.length === 0 ? (
                <div className="empty-state">
                  <span className="material-icons">receipt_long</span>
                  <p>No hay transacciones recientes</p>
                </div>
              ) : (
                lastTransactions.map((tx) => (
                  <div className="transaction-item" key={tx.id}>
                    <span className="material-icons tx-icon">receipt</span>
                    <div className="tx-info">
                      <span className="tx-number font-mono">{tx.numero}</span>
                      <span className="tx-time">{timeAgo(tx.fecha)}</span>
                    </div>
                    <span className="tx-amount font-mono">{formatMoney(tx.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Productos mas vendidos */}
          <div className="content-card products-card">
            <h3 className="card-title">Productos Mas Vendidos</h3>
            <div className="top-products">
              {topProducts.length === 0 ? (
                <div className="empty-state">
                  <span className="material-icons">inventory_2</span>
                  <p>Sin ventas registradas</p>
                </div>
              ) : (
                topProducts.map((p, i) => (
                  <div className="top-product-item" key={`${p.id}-${i}`}>
                    <span className="product-rank">#{i + 1}</span>
                    <div className="product-details">
                      <span className="product-name">{p.nombre}</span>
                      <span className="product-sold font-mono">
                        {p.vendidos} vendidos
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de detalle de un dia del grafico */}
      {detailBar && (
        <div className="modal-overlay open" onClick={() => setDetailBar(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalle del dia {detailBar.day}</h3>
            </div>
            <div className="modal-body">
              <div className="report-detail-row">
                <div className="report-detail-block">
                  <span className="material-icons">today</span>
                  <div>
                    <div className="report-detail-label">Fecha</div>
                    <div className="report-detail-value">{formatDate(detailBar.fecha)}</div>
                  </div>
                </div>
                <div className="report-detail-block">
                  <span className="legend-dot" style={{ backgroundColor: 'var(--accent)' }} />
                  <div>
                    <div className="report-detail-label">Ventas del dia</div>
                    <div className="report-detail-value font-mono">
                      {formatMoney(detailBar.value)}
                    </div>
                    <div className="report-detail-sub font-mono">
                      {detailBar.facturas} factura(s)
                    </div>
                  </div>
                </div>
              </div>
              <p className="report-detail-variation">
                Participacion en la semana:{' '}
                <strong>
                  {semanaTotal > 0 ? `${((detailBar.value / semanaTotal) * 100).toFixed(1)}%` : '--'}
                </strong>
              </p>
              {detailBar.key === mejorDia?.key && detailBar.value > 0 && (
                <p className="report-detail-best">
                  <span className="material-icons">emoji_events</span>
                  Mejor dia de la semana
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel-compact" onClick={() => setDetailBar(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
