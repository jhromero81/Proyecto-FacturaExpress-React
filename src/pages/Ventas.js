/**
 * Ventas.js
 * Modulo de gestion de ventas con carrito de compras.
 * Permite agregar productos, calcular IVA, seleccionar cliente
 * y finalizar la venta generando una factura electronica.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/common/Toast';
import { formatMoney, calcularIVA, generateInvoiceNumber } from '../utils/formatters';
import { getCollection, addToCollection, storageGet } from '../services/storageService';
import { PRODUCTOS_DEFAULT, CLIENTES_DEFAULT, IVA_RATE, ROUTES } from '../utils/constants';
import './Ventas.css';

/**
 * Componente Ventas.
 * Interfaz de punto de venta con carrito, panel de pago y busqueda de productos.
 */
const Ventas = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  /** Lista de productos disponibles */
  const [productos] = useState(() => {
    const stored = getCollection('productos');
    return stored.length > 0 ? stored : PRODUCTOS_DEFAULT;
  });

  /** Carrito de compras: items seleccionados con cantidades */
  const [cart, setCart] = useState([]);

  /** Cliente seleccionado para la venta */
  const [cliente, setCliente] = useState(() => {
    const selected = storageGet('cliente_seleccionado');
    if (selected) return selected;
    return CLIENTES_DEFAULT[0]; // Cliente por defecto
  });

  /** Texto de busqueda de productos */
  const [searchTerm, setSearchTerm] = useState('');

  /** Referencia para limpiar timeout al desmontar */
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /** Control del modal de seleccion de cliente */
  const [showClientModal, setShowClientModal] = useState(false);

  /** Lista de clientes disponibles */
  const [clientes] = useState(() => {
    const stored = getCollection('clientes');
    return stored.length > 0 ? stored : CLIENTES_DEFAULT;
  });

  /**
   * Calcula el subtotal sumando (precio * cantidad) de todos los items.
   */
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  }, [cart]);

  /**
   * Calcula el IVA total de la venta.
   */
  const iva = useMemo(() => {
    return Math.round(subtotal * IVA_RATE);
  }, [subtotal]);

  /** Descuento fijo (por implementar) */
  const descuento = 0;

  /** Total de la venta */
  const total = subtotal + iva - descuento;

  /**
   * Agrega un producto al carrito.
   * Si ya existe, incrementa la cantidad respetando el stock.
   */
  const addToCart = useCallback((producto) => {
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
   * Genera una factura y la almacena en localStorage.
   */
  const finalizeSale = useCallback(() => {
    if (cart.length === 0) {
      showToast('Agregue al menos un producto para finalizar la venta', 'warning');
      return;
    }

    const factura = {
      numero: generateInvoiceNumber(),
      fecha: new Date().toISOString(),
      cliente: cliente,
      items: cart.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precioUnitario: item.precio,
        iva: calcularIVA(item.precio * item.cantidad),
        subtotal: item.precio * item.cantidad,
      })),
      subtotal,
      iva,
      descuento,
      total,
      estado: 'enviado',
    };

    // Almacenar la factura
    addToCollection('facturas', factura);

    showToast(`Venta finalizada: ${factura.numero}`, 'success');

    // Limpiar carrito
    setCart([]);

    // Preguntar si desea ir al historial
    timerRef.current = setTimeout(() => {
      if (window.confirm('Venta registrada. Desea ver el historial de facturacion?')) {
        navigate(ROUTES.FACTURACION);
      }
    }, 500);
  }, [cart, cliente, subtotal, iva, descuento, total, showToast, navigate]);

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
          {/* Botones de accion principal */}
          <div className="ventas-actions">
            <button
              className="btn-teal"
              onClick={() => setCart([])}
            >
              <span className="material-icons">add_shopping_cart</span>
              Nueva Venta
            </button>
            <button
              className="btn-outline-accent"
              onClick={() => setShowClientModal(true)}
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
            <div className="payment-row">
              <span>IVA (19%)</span>
              <span className="font-mono">{formatMoney(iva)}</span>
            </div>
            {descuento > 0 && (
              <div className="payment-row discount">
                <span>Descuento</span>
                <span className="font-mono">-{formatMoney(descuento)}</span>
              </div>
            )}
          </div>

          <div className="payment-divider" />

          <div className="payment-total">
            <span>Total</span>
            <span className="total-val font-mono">{formatMoney(total)}</span>
          </div>

          <button className="btn-finalizar" onClick={finalizeSale}>
            FINALIZAR VENTA
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
