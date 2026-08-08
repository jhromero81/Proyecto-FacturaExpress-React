/**
 * Usuarios.js
 * Modulo de administracion de usuarios (solo admin).
 * Permite crear, editar, activar/desactivar y eliminar perfiles de
 * acceso al sistema, con contrasenas encriptadas.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import useDebounce from '../hooks/useDebounce';
import { useToast } from '../components/common/Toast';
import { validateUsuario } from '../utils/validators';
import { PERFILES_USUARIO } from '../utils/constants';
import { getUsuarios, createUsuario, updateUsuario, toggleUsuarioActivo, deleteUsuario } from '../services/api';
import './Usuarios.css';

/** Formulario vacio de usuario */
const EMPTY_FORM = {
  nit: '',
  nombre: '',
  email: '',
  telefono: '',
  rol: 'vendedor',
  password: '',
};

/** Nombre legible de un rol */
const rolLabel = (rol) =>
  PERFILES_USUARIO[rol?.toUpperCase()]?.nombre || rol || '--';

/**
 * Componente Usuarios.
 * Tabla de usuarios del sistema con CRUD completo.
 */
const Usuarios = () => {
  const { showToast } = useToast();

  /** Lista de usuarios */
  const [usuarios, setUsuarios] = useState([]);

  /** Estado de carga */
  const [loading, setLoading] = useState(true);

  /** Texto de busqueda con debounce */
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  /** Filtro por rol */
  const [rolFilter, setRolFilter] = useState('');

  /** Control del modal */
  const [showModal, setShowModal] = useState(false);

  /** Usuario en edicion (null = crear) */
  const [editingId, setEditingId] = useState(null);

  /** Datos del formulario */
  const [formData, setFormData] = useState(EMPTY_FORM);

  /** Errores de validacion */
  const [errors, setErrors] = useState({});

  /** Cargar usuarios desde la API al montar */
  useEffect(() => {
    let mounted = true;

    getUsuarios({ limite: 200 })
      .then((res) => {
        if (mounted) setUsuarios(res.usuarios || []);
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

  /**
   * Filtra usuarios por busqueda y rol.
   */
  const filteredUsuarios = useMemo(() => {
    let result = usuarios;
    if (rolFilter) result = result.filter((u) => u.rol === rolFilter);
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter(
        (u) =>
          u.nombre.toLowerCase().includes(term) ||
          u.nit.toLowerCase().includes(term) ||
          (u.email && u.email.toLowerCase().includes(term))
      );
    }
    return result;
  }, [usuarios, rolFilter, debouncedSearch]);

  /** Actualiza un campo del formulario y limpia su error */
  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  /** Abre el modal para crear un usuario */
  const openCreate = useCallback(() => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
  }, []);

  /** Abre el modal para editar un usuario */
  const openEdit = useCallback((usuario) => {
    setEditingId(usuario.id);
    setFormData({
      nit: usuario.nit,
      nombre: usuario.nombre,
      email: usuario.email || '',
      telefono: usuario.telefono || '',
      rol: usuario.rol,
      password: '',
    });
    setErrors({});
    setShowModal(true);
  }, []);

  /** Guarda (crea o actualiza) un usuario */
  const handleSave = useCallback(async () => {
    const isEdit = Boolean(editingId);
    const validation = validateUsuario(formData, { requierePassword: !isEdit });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const payload = {
      nit: formData.nit.trim(),
      nombre: formData.nombre.trim(),
      email: formData.email.trim(),
      telefono: formData.telefono.trim(),
      rol: formData.rol,
    };
    if (formData.password) payload.password = formData.password;

    try {
      if (isEdit) {
        const res = await updateUsuario(editingId, payload);
        setUsuarios((prev) => prev.map((u) => (u.id === editingId ? res.usuario : u)));
        showToast('Usuario actualizado correctamente', 'success');
      } else {
        const res = await createUsuario(payload);
        setUsuarios((prev) => [res.usuario, ...prev]);
        showToast('Usuario creado correctamente', 'success');
      }
      setShowModal(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [formData, editingId, showToast]);

  /** Activa o desactiva un usuario */
  const handleToggle = useCallback(async (usuario) => {
    try {
      const res = await toggleUsuarioActivo(usuario.id, !usuario.activo);
      setUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? res.usuario : u)));
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  /** Elimina un usuario */
  const handleDelete = useCallback(async (usuario) => {
    if (!window.confirm(`Desea eliminar el usuario "${usuario.nombre}"?`)) return;
    try {
      await deleteUsuario(usuario.id);
      setUsuarios((prev) => prev.filter((u) => u.id !== usuario.id));
      showToast('Usuario eliminado correctamente', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  return (
    <div className="usuarios-page">
      {/* Barra de herramientas */}
      <div className="usuarios-toolbar">
        <div className="search-wrapper">
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="Buscar usuario por nombre, NIT o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="toolbar-actions">
          <select
            className="rol-filter"
            value={rolFilter}
            onChange={(e) => setRolFilter(e.target.value)}
          >
            <option value="">Todos los roles</option>
            {Object.values(PERFILES_USUARIO).map((perfil) => (
              <option key={perfil.rol} value={perfil.rol}>
                {perfil.nombre}
              </option>
            ))}
          </select>
          <button className="btn-teal" onClick={openCreate}>
            <span className="material-icons">person_add</span>
            NUEVO USUARIO
          </button>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="content-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>NIT</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="empty-table">
                  <span className="material-icons">sync</span>
                  <p>Cargando usuarios...</p>
                </td>
              </tr>
            ) : filteredUsuarios.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-table">
                  <span className="material-icons">admin_panel_settings</span>
                  <p>No se encontraron usuarios</p>
                </td>
              </tr>
            ) : (
              filteredUsuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td>
                    <div className="user-cell">
                      <span className="material-icons user-icon">account_circle</span>
                      {usuario.nombre}
                    </div>
                  </td>
                  <td className="font-mono">{usuario.nit}</td>
                  <td>{usuario.email || '--'}</td>
                  <td>
                    <span className={`rol-badge ${usuario.rol}`}>{rolLabel(usuario.rol)}</span>
                  </td>
                  <td>
                    <span className={`badge-status ${usuario.activo ? 'enviada' : 'rechazada'}`}>
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="product-actions">
                      <button
                        className="action-btn"
                        onClick={() => openEdit(usuario)}
                        title="Editar"
                      >
                        <span className="material-icons">edit</span>
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => handleToggle(usuario)}
                        title={usuario.activo ? 'Desactivar' : 'Activar'}
                      >
                        <span className="material-icons">
                          {usuario.activo ? 'toggle_off' : 'toggle_on'}
                        </span>
                      </button>
                      <button
                        className="action-btn danger"
                        onClick={() => handleDelete(usuario)}
                        title="Eliminar"
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

      {/* Modal de crear/editar usuario */}
      <div
        className={`modal-overlay ${showModal ? 'open' : ''}`}
        onClick={() => setShowModal(false)}
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{editingId ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label>NIT *</label>
              <input
                type="text"
                placeholder="Ej: 900.123.456-7"
                value={formData.nit}
                onChange={(e) => handleChange('nit', e.target.value)}
                className={errors.nit ? 'input-error' : ''}
              />
              {errors.nit && <span className="error-text">{errors.nit}</span>}
            </div>

            <div className="form-group">
              <label>Nombre Completo *</label>
              <input
                type="text"
                placeholder="Nombre del usuario"
                value={formData.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                className={errors.nombre ? 'input-error' : ''}
              />
              {errors.nombre && <span className="error-text">{errors.nombre}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="correo@empresa.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={errors.email ? 'input-error' : ''}
                />
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>
              <div className="form-group">
                <label>Telefono</label>
                <input
                  type="tel"
                  placeholder="+57 300 123 4567"
                  value={formData.telefono}
                  onChange={(e) => handleChange('telefono', e.target.value)}
                  className={errors.telefono ? 'input-error' : ''}
                />
                {errors.telefono && <span className="error-text">{errors.telefono}</span>}
              </div>
            </div>

            <div className="form-group">
              <label>Rol *</label>
              <select
                value={formData.rol}
                onChange={(e) => handleChange('rol', e.target.value)}
              >
                {Object.values(PERFILES_USUARIO).map((perfil) => (
                  <option key={perfil.rol} value={perfil.rol}>
                    {perfil.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{editingId ? 'Nueva Contrasena (opcional)' : 'Contrasena *'}</label>
              <input
                type="password"
                placeholder={editingId ? 'Dejar vacio para no cambiar' : 'Minimo 4 caracteres'}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className={errors.password ? 'input-error' : ''}
              />
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-cancel-compact" onClick={() => setShowModal(false)}>
              Cancelar
            </button>
            <button className="btn-teal" onClick={handleSave}>
              {editingId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Usuarios;
