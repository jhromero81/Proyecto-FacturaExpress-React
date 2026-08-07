/**
 * Auditoria.js
 * Modulo de auditoria del sistema (solo admin).
 * Muestra la bitacora de operaciones criticas realizadas por los
 * usuarios, con filtros por tabla afectada.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from '../components/common/Toast';
import { formatDate, timeAgo } from '../utils/formatters';
import { getLogs } from '../services/api';
import './Auditoria.css';

/**
 * Componente Auditoria.
 * Tabla de registros de auditoria con filtros y KPIs basicos.
 */
const Auditoria = () => {
  const { showToast } = useToast();

  /** Registros de auditoria */
  const [logs, setLogs] = useState([]);

  /** Tablas disponibles para el filtro */
  const [tablas, setTablas] = useState([]);

  /** Estado de carga */
  const [loading, setLoading] = useState(true);

  /** Filtro por tabla */
  const [tablaFilter, setTablaFilter] = useState('');

  /** Filtro por texto en la accion */
  const [searchTerm, setSearchTerm] = useState('');

  /** Carga los registros de auditoria */
  const loadLogs = useCallback(async () => {
    setLoading(true);
    const params = { limite: 300 };
    if (tablaFilter) params.tabla = tablaFilter;

    try {
      const res = await getLogs(params);
      setLogs(res.logs || []);
      setTablas(res.tablas || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [tablaFilter, showToast]);

  /** Cargar al montar y cuando cambia el filtro de tabla */
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  /** Registros filtrados por texto de accion */
  const filteredLogs = useCallback(() => {
    if (!searchTerm.trim()) return logs;
    const term = searchTerm.toLowerCase();
    return logs.filter(
      (l) =>
        l.accion.toLowerCase().includes(term) ||
        (l.usuarioNombre && l.usuarioNombre.toLowerCase().includes(term))
    );
  }, [logs, searchTerm]);

  const visibleLogs = filteredLogs();

  return (
    <div className="auditoria-page">
      {/* Barra de herramientas */}
      <div className="auditoria-toolbar">
        <div className="search-wrapper">
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="Buscar por accion o usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select
            className="filter-select"
            value={tablaFilter}
            onChange={(e) => setTablaFilter(e.target.value)}
          >
            <option value="">Todas las tablas</option>
            {tablas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="logs-count font-mono">{visibleLogs.length} registros</span>
        </div>
      </div>

      {/* Tabla de auditoria */}
      <div className="content-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Accion</th>
              <th>Tabla</th>
              <th>Registro</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="empty-table">
                  <span className="material-icons">sync</span>
                  <p>Cargando auditoria...</p>
                </td>
              </tr>
            ) : visibleLogs.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-table">
                  <span className="material-icons">fact_check</span>
                  <p>No hay registros de auditoria</p>
                </td>
              </tr>
            ) : (
              visibleLogs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <div className="fecha-cell">
                      <span className="font-mono">{formatDate(log.fecha)}</span>
                      <span className="fecha-ago">{timeAgo(log.fecha)}</span>
                    </div>
                  </td>
                  <td>{log.usuarioNombre}</td>
                  <td>
                    <span className={`accion-tag ${log.accion.startsWith('DELETE') ? 'del' : log.accion.startsWith('INSERT') ? 'ins' : 'upd'}`}>
                      {log.accion}
                    </span>
                  </td>
                  <td>
                    <span className="tabla-tag font-mono">{log.tabla}</span>
                  </td>
                  <td className="font-mono">{log.registroId ?? '--'}</td>
                  <td className="font-mono">{log.ip}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Auditoria;
