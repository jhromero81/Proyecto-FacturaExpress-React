/**
 * Clientes.js
 * Modulo de directorio de clientes.
 * Permite ver, crear, buscar y gestionar clientes del sistema.
 * Incluye navegacion cruzada al modulo de ventas.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import { useToast } from '../components/common/Toast';
import { validateCliente } from '../utils/validators';
import { storageSet } from '../services/storageService';
import { getClientes, createCliente, updateCliente, deleteCliente } from '../services/api';
import { ROUTES } from '../utils/constants';
import './Clientes.css';

/**
 * Componente Clientes.
 * Directorio de clientes con tarjetas, busqueda y formulario de creacion.
 */
const Clientes = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  /** Lista de clientes */
  const [clientes, setClientes] = useState([]);

  /** Estado de carga del directorio */
  const [loading, setLoading] = useState(true);

  /** Cargar los clientes desde la API al montar */
  useEffect(() => {
    let mounted = true;

    getClientes()
      .then((res) => {
        if (mounted) setClientes(res.clientes || []);
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

  /** Texto de busqueda con debounce */
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  /** Control del modal de nuevo cliente */
  const [showModal, setShowModal] = useState(false);

  /** Cliente en edicion (null = crear) */
  const [editingId, setEditingId] = useState(null);

  /** Datos del formulario de nuevo cliente */
  const [formData, setFormData] = useState({
    identificacion: '',
    nombre: '',
    email: '',
    telefono: '',
  });

  /** Errores de validacion */
  const [errors, setErrors] = useState({});

  /**
   * Filtra clientes por el termino de busqueda debounce.
   */
  const filteredClientes = useMemo(() => {
    if (!debouncedSearch.trim()) return clientes;
    const term = debouncedSearch.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(term) ||
        c.identificacion.toLowerCase().includes(term) ||
        (c.email && c.email.toLowerCase().includes(term))
    );
  }, [clientes, debouncedSearch]);

  /**
   * Actualiza el campo del formulario y limpia su error.
   */
  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  /**
   * Valida y guarda un nuevo cliente via la API.
   */
  const handleSave = useCallback(async () => {
    const validation = validateCliente(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    try {
      if (editingId) {
        const res = await updateCliente(editingId, formData);
        setClientes((prev) =>
          prev.map((c) => (c.id === editingId ? res.cliente : c))
        );
        showToast('Cliente actualizado correctamente', 'success');
      } else {
        const res = await createCliente(formData);
        setClientes((prev) => [res.cliente, ...prev]);
        showToast('Cliente registrado correctamente', 'success');
      }
      setFormData({ identificacion: '', nombre: '', email: '', telefono: '' });
      setErrors({});
      setEditingId(null);
      setShowModal(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [formData, editingId, showToast]);

  /** Abre el modal para editar un cliente existente */
  const openEdit = useCallback((cliente) => {
    setEditingId(cliente.id);
    setFormData({
      identificacion: cliente.identificacion,
      nombre: cliente.nombre,
      email: cliente.email || '',
      telefono: cliente.telefono || '',
    });
    setErrors({});
    setShowModal(true);
  }, []);

  /** Elimina un cliente con confirmacion */
  const handleDelete = useCallback(async (cliente) => {
    if (!window.confirm(`Desea eliminar el cliente "${cliente.nombre}"?`)) return;
    try {
      const res = await deleteCliente(cliente.id);
      setClientes((prev) => prev.filter((c) => c.id !== cliente.id));
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  /**
   * Navega al modulo de ventas con el cliente preseleccionado.
   */
  const goToSale = useCallback(
    (cliente) => {
      storageSet('cliente_seleccionado', cliente);
      navigate(ROUTES.VENTAS);
    },
    [navigate]
  );

  return (
    <div className="clientes-page">
      {/* Barra de herramientas */}
      <div className="clientes-toolbar">
        <div className="search-wrapper">
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="Buscar cliente por nombre, NIT o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-teal" onClick={() => setShowModal(true)}>
          <span className="material-icons">person_add</span>
          NUEVO CLIENTE
        </button>
      </div>

      {/* Grid de tarjetas de clientes */}
      <div className="clientes-grid" id="clientesGrid">
        {loading ? (
          <div className="empty-state">
            <span className="material-icons">sync</span>
            <p>Cargando clientes...</p>
          </div>
        ) : filteredClientes.length === 0 ? (
          <div className="empty-state">
            <span className="material-icons">group</span>
            <p>No se encontraron clientes</p>
          </div>
        ) : (
          filteredClientes.map((cliente) => (
            <div className="client-card" key={cliente.id}>
              <div className="client-card-header">
                <span className="material-icons client-avatar">account_circle</span>
                <span className="client-id font-mono">{cliente.identificacion}</span>
              </div>
              <h4 className="client-name">{cliente.nombre}</h4>
              <p className="client-email">{cliente.email || 'Sin email'}</p>
              <div className="client-card-actions">
                <button
                  className="client-action-link"
                  onClick={() => goToSale(cliente)}
                >
                  <span className="material-icons">shopping_cart</span>
                  Nueva Venta
                </button>
                <button
                  className="client-action-icon"
                  onClick={() => openEdit(cliente)}
                  title="Editar cliente"
                >
                  <span className="material-icons">edit</span>
                </button>
                <button
                  className="client-action-icon"
                  onClick={() => handleDelete(cliente)}
                  title="Eliminar cliente"
                >
                  <span className="material-icons">delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de nuevo/editar cliente */}
      <div
        className={`modal-overlay ${showModal ? 'open' : ''}`}
        onClick={() => {
          setShowModal(false);
          setEditingId(null);
          setFormData({ identificacion: '', nombre: '', email: '', telefono: '' });
        }}
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
          </div>
          <div className="modal-body">
            {/* Campo identificacion */}
            <div className="form-group">
              <label>Numero de Identificacion *</label>
              <input
                type="text"
                placeholder="Ej: 80.123.456-1"
                value={formData.identificacion}
                onChange={(e) => handleChange('identificacion', e.target.value)}
                className={errors.identificacion ? 'input-error' : ''}
              />
              {errors.identificacion && (
                <span className="error-text">{errors.identificacion}</span>
              )}
            </div>

            {/* Campo nombre */}
            <div className="form-group">
              <label>Nombre Completo *</label>
              <input
                type="text"
                placeholder="Razon social o nombre completo"
                value={formData.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                className={errors.nombre ? 'input-error' : ''}
              />
              {errors.nombre && (
                <span className="error-text">{errors.nombre}</span>
              )}
            </div>

            {/* Campo email */}
            <div className="form-group">
              <label>Correo Electronico</label>
              <input
                type="email"
                placeholder="correo@empresa.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={errors.email ? 'input-error' : ''}
              />
              {errors.email && (
                <span className="error-text">{errors.email}</span>
              )}
            </div>

            {/* Campo telefono */}
            <div className="form-group">
              <label>Telefono</label>
              <input
                type="tel"
                placeholder="+57 300 123 4567"
                value={formData.telefono}
                onChange={(e) => handleChange('telefono', e.target.value)}
                className={errors.telefono ? 'input-error' : ''}
              />
              {errors.telefono && (
                <span className="error-text">{errors.telefono}</span>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="btn-cancel-compact"
              onClick={() => {
                setShowModal(false);
                setEditingId(null);
                setFormData({ identificacion: '', nombre: '', email: '', telefono: '' });
              }}
            >
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

export default Clientes;
