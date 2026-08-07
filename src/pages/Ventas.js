/**
 * Ventas.js
 * Modulo de gestion de ventas con carrito de compras.
 * Permite agregar productos, calcular IVA, seleccionar cliente
 * y finalizar la venta generando una factura electronica.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/common/Toast';
import { formatMoney } from '../utils/formatters';
import { storageGet, storageRemove } from '../services/storageService';
import { getProductos, getClientes, createFactura } from '../services/api';
import { IVA_RATE, ROUTES } from '../utils/constants';
import './Ventas.css';

/**
 * Componente Ventas.
 * Interfaz de punto de venta con carrito, panel de pago y busqueda de productos.
 */
const Ventas = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  /** Lista de productos disponibles */
  const [productos, setProductos] = useState([]);

  /** Carrito de compras: items seleccionados con cantidades */
  const [cart, setCart] = useState([]);

  /** Cliente seleccionado para la venta */
  const [cliente, setCliente] = useState(null);

  /** Lista de clientes disponibles */
  const [clientes, setClientes] = useState([]);

  /** Estado de carga de catalogo y clientes */
  const [loading, setLoading] = useState(true);

  /** Estado de carga al finalizar la venta */
  const [isFinalizing, setIsFinalizing] = useState(false);

  /** Texto de busqueda de productos */
  const [searchTerm, setSearchTerm] = useState('');

  /** Referencia para limpiar timeout al desmontar */
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /** Cargar catalogo de productos y clientes desde la API */
  useEffect(() => {
    let mounted = true;

    Promise.all([getProductos(), getClientes()])
      .then(([productosRes, clientesRes]) => {
        if (!mounted) return;
        setProductos(productosRes.productos || []);
        setClientes(clientesRes.clientes || []);

        // Preservar el cliente preseleccionado desde el modulo de clientes
        const preseleccionado = storageGet('cliente_seleccionado');
        const lista = clientesRes.clientes || [];
        if (preseleccionado) {
          const match = lista.find((c) => c.id === preseleccionado.id);
          if (match) {
            setCliente(match);
          }
          // La preseleccion es de un solo uso: limpiarla para no quedar fija
          storageRemove('cliente_seleccionado');
        }
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [showToast]);

  /** Control del modal de seleccion de cliente */
  const [showClientModal, setShowClientModal] = useState(false);

  /** Descuento porcentual aplicado a la venta (0 - 100) */
  const [descuentoPct, setDescuentoPct] = useState(0);

  /**
   * Calcula el subtotal sumando (precio * cantidad) de todos los items.
   */
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  }, [cart]);

  /** Monto del descuento porcentual sobre el subtotal */
  const montoDescuento = useMemo(() => {
    return Math.round(subtotal * (Math.min(Math.max(descuentoPct, 0), 100) / 100));
  }, [subtotal, descuentoPct]);

  /** Base gravable tras aplicar el descuento */
  const baseGravable = subtotal - montoDescuento;

  /**
   * Calcula el IVA total de la venta (sobre la base descontada).
   */
  const iva = useMemo(() => {
    return Math.round(baseGravable * IVA_RATE);
  }, [baseGravable]);

  /** Total de la venta */
  const total = baseGravable + iva;

  /**
   * Agrega un producto al carrito.
   * Si ya existe, incrementa la cantidad respetando el stock.
   */
  const addToCart = useCallback((producto) => {
    if (producto.stock <= 0) {
      showToast('Stock insuficiente para agregar este producto', 'warning');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.id === producto.id);
      if (existing) {
        // Verificar stock disponible
        if (existing.cantidad >= producto.stock) {
          showToast('Stock insuficiente para agregar mas unidades', 'warning');
          return prev;
        }
        return prev.map((item) =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      // Agregar nuevo item al carrito
      return [...prev, { ...producto, cantidad: 1 }];
    });
  }, [showToast]);

  /**
   * Incrementa la cantidad de un item en el carrito.
   * Verifica que no exceda el stock disponible.
   */
  const incrementQty = useCallback((id) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.cantidad >= item.stock) {
          showToast('Stock insuficiente para agregar mas unidades', 'warning');
          return item;
        }
        return { ...item, cantidad: item.cantidad + 1 };
      })
    );
  }, [showToast]);

  /**
   * Decrementa la cantidad de un item en el carrito.
   * Si la cantidad llega a 1, no decrementa mas.
   */
  const decrementQty = useCallback((id) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id && item.cantidad > 1
          ? { ...item, cantidad: item.cantidad - 1 }
          : item
      )
    );
  }, []);

  /** Elimina un item del carrito */
  const removeFromCart = useCallback((id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * Finaliza la venta actual.
   * Envia la venta a la API, que genera la factura electronica
   * y descuenta el stock en una transaccion atomica.
   */
  const finalizeSale = useCallback(async () => {
    if (cart.length === 0) {
      showToast('Agregue al menos un producto para finalizar la venta', 'warning');
      return;
    }
    if (!cliente) {
      showToast('Seleccione un cliente para la venta', 'warning');
      return;
    }

    setIsFinalizing(true);
    try {
      const result = await createFactura({
        clienteId: cliente.id,
        items: cart.map((item) => ({
          productoId: item.id,
          cantidad: item.cantidad,
        })),
        descuento: descuentoPct,
      });

      showToast(`Venta finalizada: ${result.factura.numero}`, 'success');

      // Limpiar carrito, cliente y descuento para la siguiente venta
      setCart([]);
      setCliente(null);
      setDescuentoPct(0);
      storageRemove('cliente_seleccionado');

      // Preguntar si desea ir al historial
      timerRef.current = setTimeout(() => {
        if (window.confirm('Venta registrada. Desea ver el historial de facturacion?')) {
          navigate(ROUTES.FACTURACION);
        }
      }, 500);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsFinalizing(false);
    }
  }, [cart, cliente, descuentoPct, showToast, navigate]);

  /**
   * Filtra productos por el termino de busqueda.
   */
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) ||
        p.codigo.toLowerCase().includes(term)
    );
  }, [searchTerm, productos]);

  /**
   * Selecciona un cliente para la venta actual.
   */
  const selectClient = useCallback((c) => {
    setCliente(c);
    setShowClientModal(false);
  }, []);

  return (
    <div className="ventas-page">
      <div className="ventas-layout">
        {/* Panel izquierdo: formulario de venta */}
        <div className="ventas-form-panel">
          {/* Indicador de carga del catalogo */}
          {loading && (
            <div className="empty-state">
              <span className="material-icons">sync</span>
              <p>Cargando catalogo de productos y clientes...</p>
            </div>
          )}

          {/* Botones de accion principal */}
          <div className="ventas-actions">
            <button
              className="btn-teal"
              onClick={() => {
                setCart([]);
                setCliente(null);
                setDescuentoPct(0);
              }}
              disabled={loading}
            >
              <span className="material-icons">add_shopping_cart</span>
              Nueva Venta
            </button>
            <button
              className="btn-outline-accent"
              onClick={() => setShowClientModal(true)}
              disabled={loading}
            >
              <span className="material-icons">person_add</span>
              Cambiar Cliente
            </button>
          </div>

          {/* Informacion del cliente seleccionado */}
          <div className="ventas-client-info">
            <div className="form-group">
              <label>Cliente (NIT)</label>
              <input
                type="text"
                value={cliente?.identificacion || ''}
                readOnly
                placeholder="Seleccione un cliente"
              />
            </div>
            <div className="form-group">
              <label>Nombre</label>
              <input
                type="text"
                value={cliente?.nombre || ''}
                readOnly
                placeholder="Nombre del cliente"
              />
            </div>
          </div>

          {/* Busqueda y adicion de productos */}
          <div className="ventas-product-search">
            <div className="search-input-wrapper">
              <span className="material-icons">barcode</span>
              <input
                type="text"
                placeholder="Buscar producto por nombre o codigo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {/* Sugerencias de busqueda */}
            {filteredProducts.length > 0 && (
              <div className="search-suggestions">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    className="suggestion-item"
                    onClick={() => {
                      addToCart(p);
                      setSearchTerm('');
                    }}
                  >
                    <span className="suggestion-name">{p.nombre}</span>
                    <span className="suggestion-price font-mono">
                      {formatMoney(p.precio)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabla de items en el carrito */}
          <div className="cart-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Cantidad</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-cart">
                      <span className="material-icons">shopping_cart</span>
                      <p>Carrito vacio. Busque y agregue productos.</p>
                    </td>
                  </tr>
                ) : (
                  cart.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="product-name-cell">
                          <span className="product-name">{item.nombre}</span>
                          <span className="product-code font-mono">{item.codigo}</span>
                        </div>
                      </td>
                      <td className="amount-cell font-mono">{formatMoney(item.precio)}</td>
                      <td>
                        <div className="qty-controls">
                          <button
                            className="qty-btn"
                            onClick={() => decrementQty(item.id)}
                          >
                            -
                          </button>
                          <span className="qty-value font-mono">{item.cantidad}</span>
                          <button
                            className="qty-btn"
                            onClick={() => incrementQty(item.id)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="amount-cell font-mono">
                        {formatMoney(item.precio * item.cantidad)}
                      </td>
                      <td>
                        <button
                          className="qty-btn delete-btn"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <span className="material-icons">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel derecho: resumen de pago */}
        <div className="payment-panel">
          <h3 className="payment-title">Resumen de Pago</h3>

          <div className="payment-rows">
            <div className="payment-row">
              <span>Subtotal</span>
              <span className="font-mono">{formatMoney(subtotal)}</span>
            </div>
            <div className="payment-row discount-input">
              <label htmlFor="descuento-venta">Descuento (%)</label>
              <input
                id="descuento-venta"
                type="number"
                min="0"
                max="100"
                step="1"
                value={descuentoPct}
                onChange={(e) =>
                  setDescuentoPct(Math.min(Math.max(Number(e.target.value) || 0, 0), 100))
                }
                placeholder="0"
              />
            </div>
            {montoDescuento > 0 && (
              <div className="payment-row discount">
                <span>Descuento ({descuentoPct}%)</span>
                <span className="font-mono">-{formatMoney(montoDescuento)}</span>
              </div>
            )}
            <div className="payment-row">
              <span>IVA (19%)</span>
              <span className="font-mono">{formatMoney(iva)}</span>
            </div>
          </div>

          <div className="payment-divider" />

          <div className="payment-total">
            <span>Total</span>
            <span className="total-val font-mono">{formatMoney(total)}</span>
          </div>

          <button className="btn-finalizar" onClick={finalizeSale} disabled={isFinalizing}>
            {isFinalizing ? 'PROCESANDO...' : 'FINALIZAR VENTA'}
          </button>

          <p className="payment-note">
            Genera XML y PDF automaticamente
          </p>
        </div>
      </div>

      {/* Modal de seleccion de cliente */}
      {showClientModal && (
        <div className="modal-overlay open" onClick={() => setShowClientModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Seleccionar Cliente</h3>
            </div>
            <div className="modal-body">
              <div className="client-list-modal">
                {clientes.map((c) => (
                  <button
                    key={c.id}
                    className={`client-option ${cliente?.id === c.id ? 'selected' : ''}`}
                    onClick={() => selectClient(c)}
                  >
                    <span className="material-icons">account_circle</span>
                    <div className="client-option-info">
                      <span className="client-option-name">{c.nombre}</span>
                      <span className="client-option-id font-mono">{c.identificacion}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-flat"
                onClick={() => setShowClientModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ventas;
