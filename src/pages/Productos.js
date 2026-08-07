/**
 * Productos.js
 * Modulo de inventario de productos.
 * Permite ver, crear, editar, eliminar y ajustar el stock de los
 * productos del catalogo.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import useDebounce from '../hooks/useDebounce';
import { useToast } from '../components/common/Toast';
import { formatMoney } from '../utils/formatters';
import { validateProducto } from '../utils/validators';
import { getProductos, createProducto, updateProducto, adjustProductoStock, deleteProducto } from '../services/api';
import './Productos.css';

/** Formulario vacio de producto */
const EMPTY_FORM = {
  codigo: '',
  nombre: '',
  precio: '',
  iva: 0.19,
  stock: '',
};

/**
 * Componente Productos.
 * Tabla del catalogo con CRUD completo y ajuste de stock.
 */
const Productos = () => {
  const { showToast } = useToast();

  /** Lista de productos */
  const [productos, setProductos] = useState([]);

  /** Estado de carga del catalogo */
  const [loading, setLoading] = useState(true);

  /** Texto de busqueda con debounce */
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  /** Control del modal de crear/editar */
  const [showModal, setShowModal] = useState(false);

  /** Producto en edicion (null = crear nuevo) */
  const [editingId, setEditingId] = useState(null);

  /** Datos del formulario */
  const [formData, setFormData] = useState(EMPTY_FORM);

  /** Errores de validacion */
  const [errors, setErrors] = useState({});

  /** Modal de ajuste de stock */
  const [stockTarget, setStockTarget] = useState(null);
  const [stockCantidad, setStockCantidad] = useState(1);

  /** Cargar productos desde la API al montar */
  useEffect(() => {
    let mounted = true;

    getProductos({ limite: 200 })
      .then((res) => {
        if (mounted) setProductos(res.productos || []);
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
   * Filtra productos por el termino de busqueda.
   */
  const filteredProductos = useMemo(() => {
    if (!debouncedSearch.trim()) return productos;
    const term = debouncedSearch.toLowerCase();
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) ||
        p.codigo.toLowerCase().includes(term)
    );
  }, [productos, debouncedSearch]);

  /** Actualiza un campo del formulario y limpia su error */
  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  /** Abre el modal para crear un nuevo producto */
  const openCreate = useCallback(() => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
  }, []);

  /** Abre el modal para editar un producto existente */
  const openEdit = useCallback((producto) => {
    setEditingId(producto.id);
    setFormData({
      codigo: producto.codigo,
      nombre: producto.nombre,
      precio: producto.precio,
      iva: producto.iva,
      stock: producto.stock,
    });
    setErrors({});
    setShowModal(true);
  }, []);

  /** Guarda (crea o actualiza) un producto */
  const handleSave = useCallback(async () => {
    const validation = validateProducto(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const payload = {
      codigo: formData.codigo.trim(),
      nombre: formData.nombre.trim(),
      precio: Number(formData.precio),
      iva: Number(formData.iva),
      stock: Number(formData.stock),
    };

    try {
      if (editingId) {
        const res = await updateProducto(editingId, payload);
        setProductos((prev) =>
          prev.map((p) => (p.id === editingId ? res.producto : p))
        );
        showToast('Producto actualizado correctamente', 'success');
      } else {
        const res = await createProducto(payload);
        setProductos((prev) => [res.producto, ...prev]);
        showToast('Producto registrado correctamente', 'success');
      }
      setShowModal(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [formData, editingId, showToast]);

  /** Confirma la eliminacion de un producto */
  const handleDelete = useCallback(async (producto) => {
    if (!window.confirm(`Desea eliminar el producto "${producto.nombre}"?`)) return;
    try {
      await deleteProducto(producto.id);
      setProductos((prev) => prev.filter((p) => p.id !== producto.id));
      showToast('Producto eliminado correctamente', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  /** Aplica el ajuste de stock (positivo suma, negativo resta) */
  const handleAdjustStock = useCallback(async () => {
    if (!stockTarget) return;
    const cantidad = Number(stockCantidad);
    if (!Number.isInteger(cantidad) || cantidad === 0) {
      showToast('La cantidad debe ser un entero distinto de cero', 'warning');
      return;
    }
    try {
      const res = await adjustProductoStock(stockTarget.id, cantidad);
      setProductos((prev) =>
        prev.map((p) => (p.id === stockTarget.id ? res.producto : p))
      );
      setStockTarget(null);
      setStockCantidad(1);
      showToast(`Stock de "${stockTarget.nombre}" ajustado`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [stockTarget, stockCantidad, showToast]);

  return (
    <div className="productos-page">
      {/* Barra de herramientas */}
      <div className="productos-toolbar">
        <div className="search-wrapper">
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="Buscar producto por nombre o codigo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-teal" onClick={openCreate}>
          <span className="material-icons">add</span>
          NUEVO PRODUCTO
        </button>
      </div>

      {/* Tabla de productos */}
      <div className="content-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Nombre</th>
              <th>Precio</th>
              <th>IVA</th>
              <th>Stock</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="empty-table">
                  <span className="material-icons">sync</span>
                  <p>Cargando catalogo...</p>
                </td>
              </tr>
            ) : filteredProductos.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-table">
                  <span className="material-icons">inventory_2</span>
                  <p>No se encontraron productos</p>
                </td>
              </tr>
            ) : (
              filteredProductos.map((producto) => (
                <tr key={producto.id}>
                  <td className="font-mono">{producto.codigo}</td>
                  <td>{producto.nombre}</td>
                  <td className="amount-cell font-mono">{formatMoney(producto.precio)}</td>
                  <td>{Math.round(producto.iva * 100)}%</td>
                  <td>
                    <span className={`stock-badge ${producto.stock <= 5 ? 'low' : ''}`}>
                      {producto.stock}
                    </span>
                  </td>
                  <td>
                    <div className="product-actions">
                      <button
                        className="action-btn"
                        onClick={() => openEdit(producto)}
                        title="Editar"
                      >
                        <span className="material-icons">edit</span>
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => {
                          setStockTarget(producto);
                          setStockCantidad(1);
                        }}
                        title="Ajustar stock"
                      >
                        <span className="material-icons">inventory</span>
                      </button>
                      <button
                        className="action-btn danger"
                        onClick={() => handleDelete(producto)}
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

      {/* Modal de crear/editar producto */}
      <div
        className={`modal-overlay ${showModal ? 'open' : ''}`}
        onClick={() => setShowModal(false)}
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{editingId ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label>Codigo *</label>
              <input
                type="text"
                placeholder="Ej: PROD006"
                value={formData.codigo}
                onChange={(e) => handleChange('codigo', e.target.value)}
                className={errors.codigo ? 'input-error' : ''}
              />
              {errors.codigo && <span className="error-text">{errors.codigo}</span>}
            </div>

            <div className="form-group">
              <label>Nombre *</label>
              <input
                type="text"
                placeholder="Nombre del producto"
                value={formData.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                className={errors.nombre ? 'input-error' : ''}
              />
              {errors.nombre && <span className="error-text">{errors.nombre}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Precio (COP) *</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.precio}
                  onChange={(e) => handleChange('precio', e.target.value)}
                  className={errors.precio ? 'input-error' : ''}
                />
                {errors.precio && <span className="error-text">{errors.precio}</span>}
              </div>

              <div className="form-group">
                <label>IVA (%)</label>
                <select
                  value={formData.iva}
                  onChange={(e) => handleChange('iva', e.target.value)}
                >
                  <option value={0.19}>19%</option>
                  <option value={0}>0%</option>
                </select>
              </div>

              <div className="form-group">
                <label>Stock *</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.stock}
                  onChange={(e) => handleChange('stock', e.target.value)}
                  className={errors.stock ? 'input-error' : ''}
                />
                {errors.stock && <span className="error-text">{errors.stock}</span>}
              </div>
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

      {/* Modal de ajuste de stock */}
      {stockTarget && (
        <div className="modal-overlay open" onClick={() => setStockTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ajustar Stock - {stockTarget.nombre}</h3>
            </div>
            <div className="modal-body">
              <p className="stock-current">
                Stock actual: <strong className="font-mono">{stockTarget.stock}</strong>
              </p>
              <div className="form-group">
                <label>Cantidad a sumar (o restar con negativo)</label>
                <input
                  type="number"
                  value={stockCantidad}
                  onChange={(e) => setStockCantidad(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel-compact" onClick={() => setStockTarget(null)}>
                Cancelar
              </button>
              <button className="btn-teal" onClick={handleAdjustStock}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Productos;
