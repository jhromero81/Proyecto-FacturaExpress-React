/**
 * Ventas.js
 * Modulo de gestion de ventas con carrito de compras.
 * Permite agregar productos, calcular IVA, seleccionar cliente
 * y finalizar la venta generando una factura electronica.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/common/Toast';
import useDialog from '../hooks/useDialog';
import { formatMoney } from '../utils/formatters';
import { storageGet, storageRemove } from '../services/storageService';
import { getProductos, getClientes, createFactura } from '../services/api';
import { IVA_RATE, ROUTES } from '../utils/constants';
import './Ventas.css';

/** Medios de pago disponibles en el POS */
const MEDIOS_PAGO = [
  { valor: 'efectivo', etiqueta: 'Efectivo', icono: 'payments' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta', icono: 'credit_card' },
  { valor: 'transferencia', etiqueta: 'Transfer.', icono: 'account_balance' },
  { valor: 'credito', etiqueta: 'Credito', icono: 'schedule' },
];

/** Presets de descuento rapido, en porcentaje */
const DESCUENTOS_RAPIDOS = [0, 5, 10, 15, 20];

/**
 * Convierte el texto del campo de descuento a numero.
 * Acepta coma decimal (uso local) e ignora cualquier otro caracter, para que
 * el usuario pueda escribir "12,5" o "$5.000" sin que el campo se bloquee.
 * @param {string} texto
 * @returns {number}
 */
const parsearDescuento = (texto) => {
  const limpio = String(texto).replace(',', '.').replace(/[^0-9.]/g, '');
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : 0;
};

/** Limita un numero a un rango cerrado */
const limitarNumero = (valor, minimo, maximo) => Math.min(Math.max(valor, minimo), maximo);

/** Formatea un porcentaje con un decimal como maximo y coma decimal */
const formatearPct = (pct) => Number(Number(pct).toFixed(1)).toString().replace('.', ',');

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

  /** Texto de busqueda de clientes por NIT (autocompletado) */
  const [clientNitSearch, setClientNitSearch] = useState('');

  /** Texto de busqueda de clientes por nombre (autocompletado) */
  const [clientNameSearch, setClientNameSearch] = useState('');

  /** Texto de busqueda dentro del modal de seleccion de cliente */
  const [clientModalSearch, setClientModalSearch] = useState('');

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

  /** Comportamiento accesible del modal de cliente */
  const clientDialogProps = useDialog(showClientModal, () => setShowClientModal(false));

  /** Descuento porcentual aplicado a la venta (0 - 100). Es la unica fuente de verdad */
  const [descuentoPct, setDescuentoPct] = useState(0);

  /** Medio de pago de la venta (efectivo por defecto) */
  const [medioPago, setMedioPago] = useState('efectivo');

  /** Plazo en dias de las ventas a credito */
  const [plazoDias, setPlazoDias] = useState(30);

  /** Numero de la ultima venta registrada, para el aviso no bloqueante */
  const [ventaReciente, setVentaReciente] = useState(null);

  /** Como se introduce el descuento: 'pct' (porcentaje) o 'monto' (pesos) */
  const [descuentoModo, setDescuentoModo] = useState('pct');

  /** Texto en curso del campo, para no pelear con el usuario mientras escribe */
  const [descuentoTexto, setDescuentoTexto] = useState('0');

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

  /** Presets y edicion del descuento comparten estado; el porcentaje manda. */

  /** Aplica un porcentaje desde los botones rapidos */
  const aplicarDescuentoRapido = (pct) => {
    setDescuentoModo('pct');
    setDescuentoTexto(String(pct));
    setDescuentoPct(pct);
  };

  /**
   * Cambia entre porcentaje y pesos conservando el valor economico:
   * al pasar a pesos se muestra el monto ya calculado y viceversa.
   */
  const cambiarModoDescuento = (modo) => {
    if (modo === descuentoModo) return;
    setDescuentoModo(modo);
    setDescuentoTexto(
      modo === 'monto' ? String(montoDescuento) : String(Number(descuentoPct.toFixed(1)))
    );
  };

  /**
   * Actualiza el descuento desde el campo de texto.
   * El texto se sanea y se limita en el mismo paso: asi el campo nunca muestra
   * un valor distinto del que se esta aplicando (antes se podia escribir 150 y
   * ver aplicado 100 sin que el campo lo dijera).
   */
  const editarDescuento = (evento) => {
    // Solo digitos y un separador decimal
    let texto = String(evento.target.value).replace(',', '.').replace(/[^0-9.]/g, '');
    const partes = texto.split('.');
    if (partes.length > 2) texto = `${partes[0]}.${partes.slice(1).join('')}`;

    const valor = parsearDescuento(texto);
    let normalizado = texto;
    let pct;

    if (descuentoModo === 'pct') {
      // Porcentaje: maximo 100 y como mucho un decimal
      if (partes[1] && partes[1].length > 1) {
        normalizado = `${partes[0]}.${partes[1].slice(0, 1)}`;
      }
      if (valor > 100) normalizado = '100';
      pct = limitarNumero(parsearDescuento(normalizado), 0, 100);
    } else {
      // Pesos: entero y nunca mas que el subtotal
      const maximo = Math.max(subtotal, 0);
      normalizado = partes[0];
      if (valor > maximo) normalizado = String(maximo);
      const monto = limitarNumero(parsearDescuento(normalizado), 0, maximo);
      pct = subtotal > 0 ? (monto / subtotal) * 100 : 0;
    }

    setDescuentoTexto(normalizado);
    setDescuentoPct(pct);
  };

  /** Quita el descuento */
  const quitarDescuento = () => {
    setDescuentoModo('pct');
    setDescuentoTexto('0');
    setDescuentoPct(0);
  };

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
        // En modo pesos el porcentaje puede salir con muchos decimales;
        // se envia con dos, que es lo que necesita el calculo del servidor.
        descuento: Number(descuentoPct.toFixed(2)),
        medioPago,
        // El plazo solo aplica a las ventas a credito
        plazoDias: medioPago === 'credito' ? plazoDias : 0,
      });

      showToast(`Venta finalizada: ${result.factura.numero}`, 'success');

      // Limpiar carrito, cliente y descuento para la siguiente venta
      setCart([]);
      setCliente(null);
      setDescuentoModo('pct');
      setDescuentoTexto('0');
      setDescuentoPct(0);
      setMedioPago('efectivo');
      setPlazoDias(30);
      storageRemove('cliente_seleccionado');

      // Aviso no bloqueante: el historial queda a un clic, sin window.confirm
      setVentaReciente(result.factura.numero);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsFinalizing(false);
    }
  }, [cart, cliente, descuentoPct, medioPago, plazoDias, showToast, navigate]);

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
   * Filtra clientes por NIT para el autocompletado.
   * Solo muestra sugerencias cuando el usuario escribe.
   */
  const filteredClientesNit = useMemo(() => {
    const term = clientNitSearch.trim().toLowerCase();
    if (!term) return [];
    return clientes.filter((c) => c.identificacion.toLowerCase().includes(term));
  }, [clientNitSearch, clientes]);

  /**
   * Filtra clientes por nombre para el autocompletado.
   * Solo muestra sugerencias cuando el usuario escribe.
   */
  const filteredClientesNombre = useMemo(() => {
    const term = clientNameSearch.trim().toLowerCase();
    if (!term) return [];
    return clientes.filter((c) => c.nombre.toLowerCase().includes(term));
  }, [clientNameSearch, clientes]);

  /**
   * Filtra clientes para el modal de seleccion.
   * Sin texto de busqueda, muestra la lista completa.
   */
  const filteredModalClientes = useMemo(() => {
    const term = clientModalSearch.trim().toLowerCase();
    if (!term) return clientes;
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(term) ||
        c.identificacion.toLowerCase().includes(term)
    );
  }, [clientModalSearch, clientes]);

  /**
   * Renderiza las sugerencias de clientes para un campo de busqueda.
   * @param {Array} lista - Clientes filtrados por el termino tecleado.
   * @param {string} termino - Texto tecleado.
   * @param {Function} limpiar - Setter del termino (se vacia al elegir).
   */
  const renderClientSuggestions = (lista, termino, limpiar) => {
    if (!termino.trim()) return null;
    if (lista.length === 0) {
      return (
        <div className="search-suggestions">
          <p className="suggestion-name" style={{ padding: '10px 14px' }}>
            Sin resultados para &quot;{termino}&quot;
          </p>
        </div>
      );
    }
    return (
      <div className="search-suggestions">
        {lista.map((c) => (
          <button
            key={c.id}
            className="suggestion-item"
            onClick={() => {
              selectClient(c);
              limpiar('');
            }}
          >
            <span className="suggestion-name">{c.nombre}</span>
            <span className="suggestion-price font-mono">{c.identificacion}</span>
          </button>
        ))}
      </div>
    );
  };

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
                quitarDescuento();
                setVentaReciente(null);
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

          {/* Busqueda de cliente: campos separados de NIT y nombre */}
          {/* Sin envoltorio intermedio: la rejilla de dos columnas del contenedor
              debe aplicar a cada campo, igual que en la version Angular */}
          <div className="ventas-client-search">
            <div className="form-group">
              <label>NIT del cliente</label>
              <div className="search-input-wrapper">
                <span className="material-icons">badge</span>
                <input
                  type="text"
                  placeholder="Digite el NIT..."
                  value={clientNitSearch}
                  onChange={(e) => setClientNitSearch(e.target.value)}
                />
              </div>
              {renderClientSuggestions(
                filteredClientesNit,
                clientNitSearch,
                setClientNitSearch
              )}
            </div>
            <div className="form-group">
              <label>Nombre del cliente</label>
              <div className="search-input-wrapper">
                <span className="material-icons">person_search</span>
                <input
                  type="text"
                  placeholder="Digite el nombre..."
                  value={clientNameSearch}
                  onChange={(e) => setClientNameSearch(e.target.value)}
                />
              </div>
              {renderClientSuggestions(
                filteredClientesNombre,
                clientNameSearch,
                setClientNameSearch
              )}
            </div>
          </div>

          {/* Cliente seleccionado para la venta */}
          {cliente ? (
            <div className="ventas-client-info">
              <div className="form-group">
                <label>Cliente (NIT)</label>
                <input
                  type="text"
                  value={cliente.identificacion}
                  readOnly
                  placeholder="NIT del cliente"
                />
              </div>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={cliente.nombre}
                  readOnly
                  placeholder="Nombre del cliente"
                />
              </div>
            </div>
          ) : (
            <div className="ventas-client-info">
              <p className="suggestion-name">No hay cliente seleccionado para la venta.</p>
            </div>
          )}

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

          {/* Aviso de la venta recien registrada (sustituye al confirm) */}
          {ventaReciente && (
            <div className="venta-reciente" role="status">
              <span className="material-icons">check_circle</span>
              <span>
                Venta <strong className="font-mono">{ventaReciente}</strong> registrada.
              </span>
              <button
                type="button"
                className="venta-reciente-link"
                onClick={() => navigate(ROUTES.FACTURACION)}
              >
                Ver historial
              </button>
              <button
                type="button"
                className="venta-reciente-close"
                onClick={() => setVentaReciente(null)}
                aria-label="Ocultar aviso"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
          )}

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
          <h2 className="payment-title">Resumen de Pago</h2>

          <div className="payment-rows">
            <div className="payment-row">
              <span>Subtotal</span>
              <span className="font-mono">{formatMoney(subtotal)}</span>
            </div>
            {/* Descuento: presets, entrada en % o en pesos y equivalencia */}
            <div className="discount-block">
              <div className="discount-head">
                <span className="discount-label" id="descuento-etiqueta">
                  Descuento
                </span>
                <div className="discount-modes" role="group" aria-label="Forma del descuento">
                  <button
                    type="button"
                    className={`discount-mode ${descuentoModo === 'pct' ? 'active' : ''}`}
                    onClick={() => cambiarModoDescuento('pct')}
                    aria-pressed={descuentoModo === 'pct'}
                    title="Descuento en porcentaje"
                  >
                    %
                  </button>
                  <button
                    type="button"
                    className={`discount-mode ${descuentoModo === 'monto' ? 'active' : ''}`}
                    onClick={() => cambiarModoDescuento('monto')}
                    aria-pressed={descuentoModo === 'monto'}
                    title="Descuento en pesos"
                  >
                    $
                  </button>
                </div>
              </div>

              <div className="discount-chips" role="group" aria-label="Descuentos rapidos">
                {DESCUENTOS_RAPIDOS.map((pct) => (
                  <button
                    type="button"
                    key={pct}
                    className={`discount-chip ${
                      descuentoModo === 'pct' && descuentoPct === pct ? 'active' : ''
                    }`}
                    onClick={() => aplicarDescuentoRapido(pct)}
                    aria-pressed={descuentoModo === 'pct' && descuentoPct === pct}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              <div className="discount-field">
                <input
                  id="descuento-venta"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={descuentoTexto}
                  onChange={editarDescuento}
                  onFocus={(evento) => evento.target.select()}
                  disabled={cart.length === 0}
                  aria-describedby="descuento-ayuda"
                  placeholder="0"
                />
                <span className="discount-unit">{descuentoModo === 'pct' ? '%' : 'COP'}</span>
                {descuentoPct > 0 && (
                  <button
                    type="button"
                    className="discount-clear"
                    onClick={quitarDescuento}
                    title="Quitar descuento"
                    aria-label="Quitar descuento"
                  >
                    <span className="material-icons">close</span>
                  </button>
                )}
              </div>

              <p className="discount-help" id="descuento-ayuda">
                {cart.length === 0
                  ? 'Agrega productos para aplicar un descuento'
                  : descuentoModo === 'monto'
                    ? `Equivale al ${formatearPct(descuentoPct)}% del subtotal`
                    : 'Se aplica al subtotal, antes del IVA'}
              </p>
            </div>

            {montoDescuento > 0 && (
              <div className="payment-row discount">
                <span>Descuento ({formatearPct(descuentoPct)}%)</span>
                <span className="font-mono">-{formatMoney(montoDescuento)}</span>
              </div>
            )}
            <div className="payment-row">
              <span>IVA (19%)</span>
              <span className="font-mono">{formatMoney(iva)}</span>
            </div>
          </div>

          {/* Medio de pago: queda registrado en la factura */}
          <div className="payment-methods-block">
            <span className="payment-methods-label" id="medio-pago-etiqueta">
              Medio de pago
            </span>
            <div className="payment-methods" role="group" aria-labelledby="medio-pago-etiqueta">
              {MEDIOS_PAGO.map((medio) => (
                <button
                  key={medio.valor}
                  type="button"
                  className={`payment-method ${medioPago === medio.valor ? 'active' : ''}`}
                  onClick={() => setMedioPago(medio.valor)}
                  aria-pressed={medioPago === medio.valor}
                >
                  <span className="material-icons">{medio.icono}</span>
                  <span>{medio.etiqueta}</span>
                </button>
              ))}
            </div>
            {medioPago === 'credito' && (
              <div className="payment-term">
                <label htmlFor="plazo-dias">Plazo</label>
                <input
                  id="plazo-dias"
                  type="number"
                  min="1"
                  max="365"
                  inputMode="numeric"
                  value={plazoDias}
                  onChange={(evento) =>
                    setPlazoDias(limitarNumero(Number(evento.target.value) || 0, 1, 365))
                  }
                />
                <span>dias</span>
              </div>
            )}
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
            Comprobante interno de demostracion (sin validez DIAN)
          </p>
        </div>
      </div>

      {/* Modal de seleccion de cliente */}
      {showClientModal && (
        <div className="modal-overlay open" onClick={() => setShowClientModal(false)}>
          <div className="modal-content" {...clientDialogProps} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Seleccionar Cliente</h3>
            </div>
            <div className="modal-body">
              {/* Busqueda de clientes por NIT o nombre */}
              <div className="search-input-wrapper">
                <span className="material-icons">search</span>
                <input
                  type="text"
                  placeholder="Buscar por NIT o nombre..."
                  value={clientModalSearch}
                  onChange={(e) => setClientModalSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="client-list-modal">
                {filteredModalClientes.length === 0 ? (
                  <p className="suggestion-name" style={{ padding: '14px' }}>
                    Sin resultados para &quot;{clientModalSearch}&quot;
                  </p>
                ) : (
                  filteredModalClientes.map((c) => (
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
                  ))
                )}
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
