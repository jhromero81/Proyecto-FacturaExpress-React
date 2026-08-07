/**
 * Dashboard.js
 * Panel principal de FacturaExpress.
 * Muestra KPIs del dia, grafico de ventas semanales y ultimas transacciones.
 */

import React, { useState, useEffect, useMemo } from 'react';

import { formatMoney, timeAgo } from '../utils/formatters';
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

  /** Datos del grafico de ventas semanales desde la API */
  const chartData = useMemo(() => {
    return ventasSemanales.map((v) => ({
      day: shortDay(v.dia),
      value: Number(v.total) || 0,
    }));
  }, [ventasSemanales]);

  /** Ultimas transacciones ordenadas (la API ya las devuelve recientes) */
  const lastTransactions = useMemo(() => {
    return transacciones;
  }, [transacciones]);

  /** Valor maximo del grafico para escalar las barras */
  const maxChartValue = Math.max(...chartData.map((d) => d.value), 0);

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
          <div className="chart-container">
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
                const x = 80 + i * 90;
                const y = 210 - barHeight;
                return (
                  <g key={d.day}>
                    {/* Barra */}
                    <rect
                      x={x}
                      y={y}
                      width="50"
                      height={barHeight}
                      rx="6"
                      fill="var(--accent)"
                      opacity="0.85"
                    >
                      <animate
                        attributeName="height"
                        from="0"
                        to={barHeight}
                        dur="0.6s"
                        fill="freeze"
                      />
                      <animate
                        attributeName="y"
                        from="210"
                        to={y}
                        dur="0.6s"
                        fill="freeze"
                      />
                    </rect>
                    {/* Valor sobre la barra */}
                    <text
                      x={x + 25}
                      y={y - 8}
                      textAnchor="middle"
                      className="chart-value-label"
                    >
                      {formatMoney(d.value)}
                    </text>
                    {/* Etiqueta del dia */}
                    <text
                      x={x + 25}
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
    </div>
  );
};

export default Dashboard;
