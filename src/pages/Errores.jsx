/**
 * Errores.js
 * Modulo de errores del sistema.
 * Muestra la bitacora de errores de los procesos internos (firma,
 * DIAN, base de datos, correo) y permite marcarlos como resueltos.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from '../components/common/Toast';
import { formatDate } from '../utils/formatters';
import { ERROR_TIPOS } from '../utils/constants';
import { getErrores, resolverError } from '../services/api';
import './Errores.css';

/** Etiqueta legible de un tipo de error */
const tipoLabel = (tipo) => tipo.charAt(0).toUpperCase() + tipo.slice(1);

/**
 * Componente Errores.
 * Tabla de errores con KPIs y filtros por tipo y estado.
 */
const Errores = () => {
  const { showToast } = useToast();

  /** Lista de errores */
  const [errores, setErrores] = useState([]);

  /** KPIs del modulo */
  const [kpis, setKpis] = useState({ total: 0, resueltos: 0, noResueltos: 0 });

  /** Estado de carga */
  const [loading, setLoading] = useState(true);

  /** Filtro por tipo */
  const [tipoFilter, setTipoFilter] = useState('');

  /** Filtro por estado (1, 0 o vacio) */
  const [resueltoFilter, setResueltoFilter] = useState('');

  /** Carga los errores con los filtros activos */
  const loadErrores = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (tipoFilter) params.tipo = tipoFilter;
    if (resueltoFilter !== '') params.resuelto = resueltoFilter;

    try {
      const res = await getErrores(params);
      setErrores(res.errores || []);
      setKpis({ total: res.total, resueltos: res.resueltos, noResueltos: res.noResueltos });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [tipoFilter, resueltoFilter, showToast]);

  /** Cargar errores al montar y cuando cambian los filtros */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const params = {};
      if (tipoFilter) params.tipo = tipoFilter;
      if (resueltoFilter !== '') params.resuelto = resueltoFilter;
      try {
        const res = await getErrores(params);
        if (!mounted) return;
        setErrores(res.errores || []);
        setKpis({ total: res.total, resueltos: res.resueltos, noResueltos: res.noResueltos });
      } catch (err) {
        if (mounted) showToast(err.message, 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [tipoFilter, resueltoFilter, showToast]);

  /** Marca un error como resuelto */
  const handleResolver = useCallback(async (error) => {
    try {
      await resolverError(error.id);
      showToast('Error marcado como resuelto', 'success');
      loadErrores();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [loadErrores, showToast]);

  return (
    <div className="errores-page">
      {/* KPIs del modulo */}
      <div className="errores-kpis">
        <div className="kpi-card total">
          <span className="material-icons">error_outline</span>
          <div>
            <span className="kpi-label">Total Errores</span>
            <span className="kpi-value font-mono">{kpis.total}</span>
          </div>
        </div>
        <div className="kpi-card open">
          <span className="material-icons">pending_actions</span>
          <div>
            <span className="kpi-label">Sin Resolver</span>
            <span className="kpi-value font-mono">{kpis.noResueltos}</span>
          </div>
        </div>
        <div className="kpi-card resolved">
          <span className="material-icons">task_alt</span>
          <div>
            <span className="kpi-label">Resueltos</span>
            <span className="kpi-value font-mono">{kpis.resueltos}</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="errores-toolbar">
        <div className="filter-group">
          <select
            className="filter-select"
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {ERROR_TIPOS.map((t) => (
              <option key={t} value={t}>
                {tipoLabel(t)}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={resueltoFilter}
            onChange={(e) => setResueltoFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="0">Sin resolver</option>
            <option value="1">Resueltos</option>
          </select>
        </div>
      </div>

      {/* Tabla de errores */}
      <div className="content-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Mensaje</th>
              <th>Factura</th>
              <th>Estado</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="empty-table">
                  <span className="material-icons">sync</span>
                  <p>Cargando errores...</p>
                </td>
              </tr>
            ) : errores.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-table">
                  <span className="material-icons">check_circle_outline</span>
                  <p>No hay errores registrados</p>
                </td>
              </tr>
            ) : (
              errores.map((error) => (
                <tr key={error.id}>
                  <td className="font-mono">{formatDate(error.createdAt)}</td>
                  <td>
                    <span className={`tipo-badge ${error.tipo}`}>{tipoLabel(error.tipo)}</span>
                  </td>
                  <td className="error-msg">{error.mensaje}</td>
                  <td className="font-mono">{error.facturaNumero || '--'}</td>
                  <td>
                    <span className={`badge-status ${error.resuelto ? 'enviada' : 'rechazada'}`}>
                      {error.resuelto ? 'Resuelto' : 'Abierto'}
                    </span>
                  </td>
                  <td>
                    {!error.resuelto && (
                      <button className="btn-outline-accent btn-sm" onClick={() => handleResolver(error)}>
                        Marcar Resuelto
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Errores;
