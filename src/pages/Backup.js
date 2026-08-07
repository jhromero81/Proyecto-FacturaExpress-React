/**
 * Backup.js
 * Modulo de respaldos y restauracion (solo admin).
 * Permite crear copias de seguridad SQL de la base de datos,
 * descargarlas, restaurarlas y eliminarlas.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from '../components/common/Toast';
import { formatDate } from '../utils/formatters';
import { getBackups, crearBackup, restaurarBackup, eliminarBackup } from '../services/api';
import { storageGet } from '../services/storageService';
import './Backup.css';

/** Formatea un tamanio en bytes a KB/MB */
const formatSize = (bytes) => {
  const size = Number(bytes || 0);
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
};

/**
 * Componente Backup.
 * Gestion de respaldos de la base de datos.
 */
const Backup = () => {
  const { showToast } = useToast();

  /** Lista de respaldos */
  const [backups, setBackups] = useState([]);

  /** Estado de carga */
  const [loading, setLoading] = useState(true);

  /** Estado de creacion/restauracion */
  const [isWorking, setIsWorking] = useState(false);

  /** Carga la lista de respaldos */
  const loadBackups = useCallback(async () => {
    try {
      const res = await getBackups();
      setBackups(res.backups || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  /** Cargar al montar */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getBackups();
        if (mounted) setBackups(res.backups || []);
      } catch (err) {
        if (mounted) showToast(err.message, 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  /** Crea un nuevo respaldo */
  const handleCrear = useCallback(async () => {
    setIsWorking(true);
    try {
      const res = await crearBackup();
      showToast(`Respaldo creado: ${res.backup.archivo}`, 'success');
      await loadBackups();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsWorking(false);
    }
  }, [loadBackups, showToast]);

  /** Descarga un respaldo */
  const handleDescargar = useCallback(async (backup) => {
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:4000/api'}/backup/${encodeURIComponent(backup.archivo)}/download`,
        {
          headers: { Authorization: `Bearer ${storageGet('auth_token') || ''}` },
        }
      );
      if (!res.ok) throw new Error('No fue posible descargar el respaldo.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.archivo;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Respaldo descargado: ${backup.archivo}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  /** Restaura la base de datos desde un respaldo */
  const handleRestaurar = useCallback(async (backup) => {
    if (!window.confirm(`Restaurara la base de datos completa desde "${backup.archivo}".\nLos datos actuales seran reemplazados. Continuar?`)) return;

    setIsWorking(true);
    try {
      const res = await restaurarBackup(backup.archivo);
      showToast(res.message, 'success');
      await loadBackups();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsWorking(false);
    }
  }, [loadBackups, showToast]);

  /** Elimina un respaldo */
  const handleEliminar = useCallback(async (backup) => {
    if (!window.confirm(`Desea eliminar el respaldo "${backup.archivo}"?`)) return;
    try {
      const res = await eliminarBackup(backup.archivo);
      showToast(res.message, 'success');
      setBackups((prev) => prev.filter((b) => b.archivo !== backup.archivo));
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  return (
    <div className="backup-page">
      {/* Panel de accion principal */}
      <div className="backup-hero">
        <div className="backup-hero-info">
          <span className="material-icons backup-icon">backup</span>
          <div>
            <h3>Respaldo de Base de Datos</h3>
            <p>
              Genere una copia de seguridad SQL completa del sistema. Los respaldos
              incluyen facturas, clientes, productos y configuracion.
            </p>
          </div>
        </div>
        <button className="btn-teal" onClick={handleCrear} disabled={isWorking}>
          <span className="material-icons">save</span>
          {isWorking ? 'CREANDO RESPALDO...' : 'CREAR RESPALDO'}
        </button>
      </div>

      {/* Tabla de respaldos */}
      <div className="content-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Archivo</th>
              <th>Tamano</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="empty-table">
                  <span className="material-icons">sync</span>
                  <p>Cargando respaldos...</p>
                </td>
              </tr>
            ) : backups.length === 0 ? (
              <tr>
                <td colSpan="4" className="empty-table">
                  <span className="material-icons">cloud_off</span>
                  <p>No hay respaldos creados. Cree el primer respaldo.</p>
                </td>
              </tr>
            ) : (
              backups.map((backup) => (
                <tr key={backup.archivo}>
                  <td className="font-mono">{backup.archivo}</td>
                  <td className="font-mono">{formatSize(backup.tamano)}</td>
                  <td>{formatDate(backup.fecha)}</td>
                  <td>
                    <div className="backup-actions">
                      <button
                        className="action-btn"
                        onClick={() => handleDescargar(backup)}
                        title="Descargar"
                        disabled={isWorking}
                      >
                        <span className="material-icons">download</span>
                      </button>
                      <button
                        className="action-btn restore"
                        onClick={() => handleRestaurar(backup)}
                        title="Restaurar"
                        disabled={isWorking}
                      >
                        <span className="material-icons">restore</span>
                      </button>
                      <button
                        className="action-btn danger"
                        onClick={() => handleEliminar(backup)}
                        title="Eliminar"
                        disabled={isWorking}
                      >
                        <span className="material-icons">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="backup-note">
        Los respaldos se almacenan localmente en el servidor. Para una estrategia
        de respaldo segura, descargue y conserve las copias fuera del equipo.
      </p>
    </div>
  );
};

export default Backup;
