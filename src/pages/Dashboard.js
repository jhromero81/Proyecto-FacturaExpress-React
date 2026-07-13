/**
 * Dashboard.js
 * Panel principal de FacturaExpress.
 * Muestra KPIs del dia, grafico de ventas semanales y ultimas transacciones.
 */

import React, { useState, useEffect, useMemo } from 'react';

import { formatMoney, timeAgo } from '../utils/formatters';
import { getCollection } from '../services/storageService';
import './Dashboard.css';

/**
 * Componente Dashboard.
 * Calcula metricas en tiempo real a partir de las facturas almacenadas.
 */
const Dashboard = () => {
  /** Facturas cargadas del almacenamiento */
  const [facturas, setFacturas] = useState([]);

  /** Cargar facturas al montar el componente */
  useEffect(() => {
    setFacturas(getCollection('facturas'));
  }, []);

  /**
   * Calcula las estadisticas del dia actual.
   * Memoidizado para evitar recalcular en cada render.
   */
  const stats = useMemo(() => {
    const hoy = new Date().toISOString().split('T')[0];
    const facturasHoy = facturas.filter((f) => f.fecha && f.fecha.startsWith(hoy));
    const totalVentas = facturasHoy.reduce((sum, f) => sum + (f.total || 0), 0);
    const totalFacturas = facturasHoy.length;
    const pendientes = facturas.filter((f) => f.estado === 'pendiente').length;
    const ticketPromedio = totalFacturas > 0 ? Math.round(totalVentas / totalFacturas) : 0;

    return {
      ventasDia: { valor: totalVentas, variacion: 12 },
      facturasEmitidas: { valor: totalFacturas, variacion: 8 },
      pendientesDIAN: { valor: pendientes, variacion: -3 },
      ticketPromedio: { valor: ticketPromedio, variacion: 5 },
    };
  }, [facturas]);

  /** Datos del grafico de ventas semanales (valores de ejemplo) */
  const chartData = useMemo(() => {
    return ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map((day, i) => ({
      day,
      value: [1200000, 1850000, 950000, 2100000, 1650000, 1400000][i],
    }));
  }, []);

  /** Ultimas 4 transacciones ordenadas por fecha (mas reciente primero) */
  const lastTransactions = useMemo(() => {
    return [...facturas]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 4);
  }, [facturas]);

  /** Valor maximo del grafico para escalar las barras */
  const maxChartValue = Math.max(...chartData.map((d) => d.value));

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
                const barHeight = (d.value / maxChartValue) * 160;
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
      </div>
    </div>
  );
};

export default Dashboard;
