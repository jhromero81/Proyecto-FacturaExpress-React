# Paridad de interfaz con la versión Angular

Este frontend (React) y `FacturaExpress-V3/frontend` (Angular) son la misma
aplicación. **La apariencia de referencia es la de Angular**: cuando algo se ve
distinto, el que se corrige es React.

## Regla de oro: los tokens no se tocan aquí

`src/styles/index.css` es una copia fiel de
`FacturaExpress-V3/frontend/src/styles.css`. Contiene los design tokens
(`--accent`, `--sidebar-bg`, `--card-bg`, `--text-dark`, `--border`,
`--font-mono`, `--sidebar-w`, `--topbar-h`, `--footer-h`, `--transition`…) y las
clases globales que usan los componentes (`.btn-teal`, `.content-card`,
`.data-table`, `.form-group`, `.modal-*`, `.toast`, `.pagination-bar`…).

Los CSS de página **no definen colores ni fuentes**: consumen esos tokens. Si el
archivo global se reemplaza por otra paleta:

- toda declaración `var(--x)` deja de resolverse y el navegador la descarta en
  silencio (botones sin color, tarjetas sin borde, sidebar sin ancho);
- no aparece ningún error en consola ni en el build;
- la interfaz se degrada por completo y el fallo solo se ve a ojo.

Eso ya ocurrió una vez. Si necesitas un token nuevo, **añádelo en los dos
archivos con el mismo valor** (`--shadow-accent` es el último ejemplo).

## Regla del color: relleno, tinta y texto encima

Un mismo color no puede hacer dos papeles. Cada familia tiene tres tokens:

| Token | Papel |
|---|---|
| `--x` | relleno (fondo de botón, badge o barra) |
| `--x-on` | texto que va **encima** de ese relleno |
| `--x-ink` | ese color usado como **texto o icono** |

Si se usa `--x` como `color:` en lugar de `--x-ink`, el contraste se rompe en
cuanto cambia el tema: es exactamente el fallo que dejó 5681 nodos por debajo de
AA. Lo mismo con `color: #fff` dentro de un componente: debe ser
`var(--accent-on)` para que el tema oscuro pueda invertir la tinta. Y no se
apaga texto con `opacity`: se añade un token más suave.

Los bloques con fondo oscuro (`.sidebar`, `.app-footer`, `.payment-panel`)
redefinen sus tokens de texto dentro de su propia regla, para que el contraste
se mida contra su fondo real.

## Modos de visualización excluyentes

Claro, oscuro y alto contraste son tres estados, no dos interruptores. Encender
uno apaga el otro (`alternarModo` en React, `actualizarPreferencias` en Angular);
con los dos activos, el alto contraste solo pisa los tokens que redefine y los
del modo oscuro se filtran, que es como se rompió el contraste en 5681 nodos.
Cualquier botón nuevo de tema debe pasar por esas funciones, nunca escribir el
estado a mano.

## Verificación automática

```bash
npm run check:tokens     # falla si algún var(--x) no tiene definición
npm run check:contraste  # falla si un par texto/fondo baja de AA en algún tema
npm test               # formatters y validators (espejo de los specs de Angular)
npm run check          # tokens + pruebas + build
```

`scripts/check-tokens.mjs` recorre `src/**/*.css`, recoge los tokens definidos y
los usados, y devuelve exit 1 si alguno se usa sin definición y sin valor de
reserva. Es el chequeo que habría detectado el incidente antes de abrir el
navegador. También corre en CI (`.github/workflows/ci.yml`).

## Verificación visual (cuando cambie algo de interfaz)

1. Levantar las dos aplicaciones y la API:

   ```bash
   # API
   cd backend && npm start
   # React
   npm start                        # http://localhost:3000
   # Angular
   cd ../FacturaExpress-V3/frontend && npx ng serve --port 4200
   ```

2. Entrar sin escribir contraseñas: firmar un JWT con el `JWT_SECRET` del
   `backend/.env` e inyectar la cookie `token` (httpOnly) en el navegador. Cada
   framework además guarda su propia clave de sesión local:
   - React: `localStorage.facturaexpress_session_active` y
     `facturaexpress_user_data`;
   - Angular: `sessionStorage.fx_usuario` y `fx_login_time`.

3. Capturar cada ruta con el mismo viewport (1440×900) y comparar píxel a píxel.
   Tabla de referencia de la última revisión (React vs Angular):

   | Pantalla | Píxeles distintos |
   | --- | --- |
   | Login | 0,02 % |
   | Clientes, Errores, Configuración, Usuarios, Auditoría, Backup | 0,00 % |
   | Productos | 0,17 % |
   | Ventas | 0,24 % |
   | Dashboard (claro y oscuro) | 0,52 % |
   | Reportes | 1,21 % |
   | Modal "Nuevo Cliente" | 0,02 % (caja 500×522 en 463,189 en ambas) |

   El residuo por debajo del 1 % es contenido (filas, cifras, barra de scroll,
   cursor de texto), no estilo. **No se "arregla":** se nombra en el reporte.

4. Si una pantalla aparece idéntica a simple vista pero el diff es alto,
   comprobar `location.pathname` y el `scrollHeight` de `.main-content`: casi
   siempre es que una de las dos está mostrando otra ruta o tiene otros datos.

## Trampas conocidas

- **`#root > *` con `display: block`**: por especificidad de ID (1,0,0) pisa
  `.login-page { display: flex }` (0,1,0) y la tarjeta de login queda pegada
  arriba a la izquierda. Sobre los hijos de la raíz se ajusta `width`, nunca
  `display`.
- **Capturar el login con sesión activa** mide dos pantallas distintas: React
  redirige al dashboard con `PublicRoute`, Angular deja ver el formulario.
- **Modales capturados durante la transición**: con `opacity < 1` el diff sale
  por encima del 60 %. Esperar a que la opacidad sea 1.
- **Tamaño de página**: la tabla de facturas usa 10 filas en ambas versiones. Si
  se cambia en una, cambia el paginador y el diff salta aunque el CSS esté bien.

## Estado vacío del gráfico semanal

Sin ventas en la semana, el gráfico mostraba solo ejes. Ambas versiones pintan
ahora `.chart-empty` sobre el área del gráfico con el mismo texto ("Sin ventas
registradas esta semana"). Cualquier cambio aquí se hace en las dos.

## Modales accesibles

`src/hooks/useDialog.js` aporta foco inicial, trampa de foco, cierre con
`Escape` y devolución del foco al elemento que abrió el diálogo. Se usa en los
diez modales de la aplicación:

> El bloqueo del scroll de fondo se dejó fuera a propósito: `overflow: hidden`
> quita la barra del navegador y desplaza el contenido ~15 px, lo que rompe la
> paridad con Angular (que no lo hace). Si se añade, tiene que ser en las dos
> aplicaciones a la vez.

```jsx
const dialogProps = useDialog(showModal, () => setShowModal(false));
<div className="modal-content" {...dialogProps}> … </div>
```

Al añadir un modal nuevo, usar el hook; no replicar la lógica a mano.
