/**
 * constants.js
 * Definicion de constantes globales de la aplicacion FacturaExpress.
 * Incluye configuracion de la empresa, parametros fiscales y rutas.
 */

/** Version de la aplicacion */
export const APP_VERSION = '2.1.0';

/** Datos de la empresa por defecto */
export const EMPRESA_DEFAULT = {
  nit: '900.123.456-7',
  razonSocial: 'Industrias Metalurgicas S.A.S',
  emailFacturacion: 'facturacion@industriasm.com',
  telefono: '+57 300 123 4567',
};

/** Tasa de IVA en Colombia (19%) */
export const IVA_RATE = 0.19;

/** Prefijo para claves en localStorage */
export const STORAGE_PREFIX = 'facturaexpress_';

/** Rutas de la aplicacion */
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  VENTAS: '/ventas',
  FACTURACION: '/facturacion',
  CLIENTES: '/clientes',
  REPORTES: '/reportes',
  CONFIGURACION: '/configuracion',
};

/** Estados posibles de una factura ante la DIAN */
export const FACTURA_ESTADOS = {
  ENVIADO: 'enviado',
  PENDIENTE: 'pendiente',
  RECHAZADO: 'rechazado',
  PROCESANDO: 'procesando',
};

/** Catalogo de colores para los estados de factura */
export const ESTADO_COLORS = {
  enviado: '#27ae60',
  pendiente: '#f39c12',
  rechazado: '#e74c3c',
  procesando: '#3498db',
};

/** Productos de ejemplo disponibles para la venta */
export const PRODUCTOS_DEFAULT = [
  { id: 1, codigo: 'PROD001', nombre: 'Insumo Industrial X', precio: 85000, iva: 0.19, stock: 50},
  { id: 2, codigo: 'PROD002', nombre: 'Insumo Industrial Y', precio: 120000, iva: 0.19, stock: 35},
  { id: 3, codigo: 'PROD003', nombre: 'Material Premium Z', precio: 250000, iva: 0.19, stock: 20},
  { id: 4, codigo: 'PROD004', nombre: 'Componente Electronico A', precio: 45000, iva: 0.19, stock: 100},
  { id: 5, codigo: 'PROD005', nombre: 'Herramienta Especial B', precio: 189000, iva: 0.19, stock: 15},
];

/** Clientes de ejemplo para el directorio */
export const CLIENTES_DEFAULT = [
  {
    id: 1,
    identificacion: '80.123.456-1',
    nombre: 'Constructora Moderna S.A.S',
    email: 'compras@constructoramoderna.com',
    telefono: '+57 310 234 5678',
  },
  {
    id: 2,
    identificacion: '90.456.789-2',
    nombre: 'Distribuidora Andina Ltda',
    email: 'pedidos@distribuidoraandina.com',
    telefono: '+57 315 678 9012',
  },
  {
    id: 3,
    identificacion: '70.789.012-3',
    nombre: 'TecnoSoluciones del Sur',
    email: 'compras@tecnosoluciones.co',
    telefono: '+57 320 345 6789',
  },
  {
    id: 4,
    identificacion: '83.234.567-4',
    nombre: 'Grupo Industrial del Norte',
    email: 'proveedores@grupoindustrial.com',
    telefono: '+57 301 456 7890',
  },
];

/** Perfiles de usuario del sistema */
export const PERFILES_USUARIO = {
  ADMIN: { nombre: 'Administrador', rol: 'admin' },
  VENDEDOR: { nombre: 'Vendedor', rol: 'vendedor' },
  CONTADOR: { nombre: 'Contador/Reportes', rol: 'contador' },
};

/** Meta mensual de ventas en COP */
export const META_VENTAS_MENSUAL = 6400000;
