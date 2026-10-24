# Accesibilidad: auditoría de contraste en los tres temas

Auditoría de `Proyecto-FacturaExpress-React` (React + Vite) y de
`FacturaExpress-V3/frontend` (Angular), que comparten la misma hoja de tokens
y deben verse igual. Se revisaron los tres temas de la aplicación: **claro**,
**oscuro** (`body.fx-dark-mode`) y **alto contraste** (`body.fx-high-contrast`).

## 1. Método

| Elemento | Detalle |
|---|---|
| Motor de reglas | axe-core 4.10.2 (el mismo que usa Lighthouse y Deque) |
| Reglas | etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` |
| Cobertura | 11 páginas por aplicación + login + modal «Nuevo Cliente» |
| Temas | 3 por página, aplicados sobre la misma carga (solo cambia la clase de `body`) |
| Viewport | 1440 × 900, escala 1 |
| Datos | API real en `localhost:4000` y MySQL, sesión de administrador |
| Rutas | tomadas del router de cada app: en React el módulo de respaldos es `/backup` (un `/backups` inexistente cae en el comodín y mide el panel) |
| Medición propia | recorrido del DOM con cálculo de luminancia relativa para verificar los pares de color y detectar casos que axe deja como «incompleto» (texto sobre degradados) |
| Otras comprobaciones | foco visible, tamaño de objetivos táctiles, nombres accesibles, landmarks, orden de encabezados, `lang`, `prefers-reduced-motion` |

## 2. Resultado antes de corregir

Nodos con violación (un nodo = un elemento que incumple al menos un criterio):

| Aplicación | Claro | Oscuro | Alto contraste |
|---|---:|---:|---:|
| React | 1116 | 686 | 1084 |
| Angular | 1080 | 660 | 1055 |
| **Total** | | | **5681** |

El 99 % eran de **contraste (1.4.3)**. El resto, tres fallos mecánicos:
`label` en Configuración (4 campos sin etiqueta asociada), `select-name` en
Usuarios, Auditoría y Errores (filtros sin nombre accesible).

Hallazgo importante: **el alto contraste no funcionaba**. El tema cambiaba
`--accent` a amarillo `#ffeb3b` y lo seguía usando como color de texto sobre
fondo blanco: 1,11:1. Es decir, el modo de accesibilidad era el menos legible
de los tres.

## 3. Causas raíz

1. **El acento se usaba con dos papeles incompatibles.** `#1abc9c` servía a la
   vez de relleno de botón (con texto blanco: 2,41:1) y de color de texto
   (2,41:1 sobre blanco). Ningún color único resuelve ambos papeles en todos
   los fondos.
2. **`--text-muted: #90a4ae`** daba 2,59:1 sobre blanco: todo el texto
   secundario de la aplicación estaba por debajo de AA, también en modo claro.
3. **Opacidades sobre texto** (`.discount-help`, `.backup-hero p`, los grupos
   del menú) multiplicaban el contraste hacia abajo: `#90a4ae` al 75 % sobre el
   sidebar se queda en 4,39:1.
4. **Tokens de fondo oscuro reutilizados en fondos oscuros con valores de fondo
   claro** (footer, panel de pago, sidebar): al oscurecer la tinta para el modo
   claro, esos bloques se quedaban sin contraste.
5. **Alto contraste a medio hacer**: solo redefinía 7 tokens y dejaba los
   tintes translúcidos de los badges (`rgba(39,174,96,.12)`) sin tocar.
6. **Texto blanco fijo** en botones de cada página (`color: #fff` repetido en
   12 hojas), que impide que el tema oscuro invierta la tinta.

## 4. Solución: cada color en dos papeles

Se separó el color de **relleno** (`--x`) del color de **tinta** (`--x-ink`) y
se añadió el color de texto que va **encima** del relleno (`--x-on`). Los tres
temas definen el mismo juego, de modo que las hojas de página no cambian de
forma al cambiar de tema.

| Token | Claro | Oscuro | Alto contraste |
|---|---|---|---|
| `--accent` (relleno) | `#0b7d66` | `#1abc9c` | `#ffe000` |
| `--accent-on` (texto encima) | `#ffffff` | `#08211c` | `#000000` |
| `--accent-ink` (acento como texto) | `#0b7d66` | `#35d3b0` | `#000000` |
| `--accent-on-dark` | `#43e3bd` | `#43e3bd` | `#ffe000` |
| `--text-muted` | `#5b6f7a` | `#90a4ae` | `#000000` |
| `--text-dark` | `#16202c` | `#e8eef2` | `#000000` |
| `--success` / `--success-ink` | `#147a45` | `#4ade80` | `#000000` |
| `--danger` / `--danger-ink` | `#b3372b` | `#ff6b5b` | `#000000` |
| `--warning` / `--warning-ink` | `#96600a` | `#f5c451` | `#000000` |
| `--info` / `--info-ink` | `#1f6ea5` | `#7cc4f0` | `#000000` |
| `--sidebar-text` / `--sidebar-muted` | `#c7d3da` / `#9db0bc` | `#d5e1e7` / `#9db0bc` | `#ffffff` |
| `--border` | `#dfe6ea` | `#3d566e` | `#000000` |

Reglas que se siguieron:

- **Un color con dos papeles necesita dos tokens.** Si un valor se usa como
  fondo de botón y como texto, se parte en `--x` y `--x-ink`.
- **Los bloques con fondo oscuro redefinen sus tokens** en su propia regla
  (`.sidebar`, `.app-footer`, `.payment-panel`): así el contraste se mide
  contra el fondo real sin tocar cada selector de texto.
- **Prohibido apagar texto con `opacity`.** Si hace falta un gris más suave, se
  añade un token, no una opacidad: la opacidad compone contra el fondo y el
  contraste deja de ser predecible.
- **El alto contraste usa texto negro sobre blanco** y el amarillo solo como
  relleno (con texto negro encima); sobre blanco el amarillo nunca es tinta.
- **Nada de `color: #fff` en componentes**: se usa `var(--accent-on)` para que
  el tema oscuro pueda invertir la tinta.

## 5. Resultado después de corregir

| Aplicación | Claro | Oscuro | Alto contraste |
|---|---:|---:|---:|
| React | 0 | 0 | 0 |
| Angular | 0 | 0 | 0 |

Comprobaciones adicionales en la pasada final:

| Comprobación | Resultado |
|---|---|
| Foco visible (2.4.7) | 14/14 elementos interactivos cambian de estilo al enfocar en cada tema |
| Tamaño de objetivos (2.5.8) | 0 controles por debajo de 24 × 24 px |
| Nombre accesible (4.1.2 / 3.3.2) | 0 controles sin nombre |
| Orden de encabezados (1.3.1) | sin saltos (h1 → h2) |
| Landmarks (1.3.1) | `main`, `nav`, `banner`, `contentinfo` presentes |
| Idioma (3.1.1) | `lang="es"` en ambas aplicaciones |
| Movimiento reducido (2.3.3) | con `prefers-reduced-motion: reduce`, las transiciones pasan de 0,3 s a 0,00001 s |
| Paridad visual React/Angular | 0,01 % – 0,11 % de píxeles distintos en los tres temas |

Queda **1 aviso «incompleto»** de axe en el login: la letra «F» del logo va
sobre un degradado y axe no puede decidir. Se verificó a mano: el degradado va
de `--accent` a `--accent-dk`, donde el texto da 5,07:1 en claro, 7,36:1 en
oscuro y 12,9:1 en alto contraste.

## 6. Los tres modos son excluyentes

Claro, oscuro y alto contraste son **tres estados de un mismo control**, no dos
interruptores independientes. Encender uno apaga el otro:

| Acción | Resultado |
|---|---|
| Pulsar «modo oscuro» desde el tema claro | oscuro activo, alto contraste apagado |
| Pulsar «alto contraste» con el modo oscuro activo | oscuro apagado, alto contraste activo |
| Pulsar «modo oscuro» con el alto contraste activo | alto contraste apagado, oscuro activo |
| Pulsar el modo que ya está activo | vuelve al tema claro |

El motivo es técnico: cada modo define la **paleta completa** (fondo, texto,
acento, bordes). Con los dos activos a la vez, el bloque de alto contraste
sobrescribe solo los tokens que redefine y los del modo oscuro se filtran
(`--sidebar-text` claro sobre sidebar negro, texto claro sobre fondo blanco...),
que es justo lo que producía 5681 nodos por debajo de AA.

Dónde vive la regla:

- `src/utils/preferences.js` — `normalizarPreferencias()`, `aplicarCambios()` y
  `alternarModo()`; ninguna ruta puede dejar los dos activos.
- `AuthContext` — `updatePreferences()` pasa por `aplicarCambios()`, así que los
  tres puntos de la interfaz (topbar, login y Configuración) cumplen la regla
  aunque se añada un botón nuevo.
- `auth.service.ts` (Angular) — la misma regla en `actualizarPreferencias()`.
- **Migración**: si `localStorage` trae los dos modos activos de una versión
  anterior, al cargar se conserva el alto contraste (es el modo de
  accesibilidad) y se reescribe la preferencia.

Cubierto con 15 pruebas en `src/utils/preferences.test.js` (incluye una
secuencia larga de pulsaciones que comprueba que nunca quedan los dos activos)
y verificado en el navegador en las dos aplicaciones.

## 7. Superficies con degradado y color propio

El panel de respaldos (`.backup-hero`) es la única superficie con **fondo
propio** dentro de una página: un degradado del acento. Ahí no valen los tokens
de la página, y axe no puede decidir el contraste porque el fondo es una imagen
(lo devuelve como `incomplete`). Tres reglas que salieron de este caso:

- **La tinta del texto la pone la superficie, no la página.** El párrafo del
  panel pasó de `opacity: .85` (heredando blanco) a un gris de página: sobre el
  teal quedó en **1,03:1** en claro y **1,08:1** en oscuro. La solución es
  `color: inherit` (hereda `--accent-on`) y arreglar el fondo.
- **El degradado debe construirse con tokens que cumplan con esa tinta**:
  `linear-gradient(135deg, var(--accent), var(--accent-dk))`. El extremo viejo
  `#16a085` daba 3,28:1 con texto blanco.
- **Los botones con fondo propio dentro de una superficie teal** usan los
  tokens del sidebar (`--sidebar-bg` / `--sidebar-text`), no `#0f1923` / `#fff`:
  en alto contraste la regla global del botón teal vuelve la tinta negra y el
  texto desaparecía sobre el fondo oscuro del botón.

La guarda cubre ahora el par `accent-on` sobre `accent-dk` (45 pares), que es el
extremo del degradado donde el contraste se rompe.

## 8. Cómo volver a verificarlo

```bash
# 1. Guard automatico de tokens de color (sin navegador, corre en CI)
npm run check:contraste

# 2. Auditoria completa con axe sobre las paginas reales:
#    - levantar API y frontend
npm run dev
#    - en la consola del navegador, con axe-core cargado:
#      axe.run(document, { runOnly: { type: 'tag',
#        values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } })
#    - repetir con document.body.classList.add('fx-dark-mode')
#      y con 'fx-high-contrast'
```

`scripts/check-contraste.mjs` lee los tres bloques de tema del CSS global y
falla con código 1 si algún par texto/fondo baja de 4,5:1 (o de 3:1 en los pares
marcados como componentes). Cubre 42 pares por tema, incluidos los que la
auditoría encontró rotos.

## 9. Cómo medir sin falsos positivos (y sin artefactos)

axe mide el contraste del **estado pintado**, no del estado final del CSS. Dos condiciones
arruinan la medición y no avisan:

- **Pestaña en segundo plano.** Si `document.visibilityState === 'hidden'`, las transiciones
  de `background-color` no avanzan: el tema oscuro se queda a medio camino y aparecen decenas
  de nodos con contraste 1,08:1 que no existen en pantalla. Se mide con `Page.bringToFront`.
- **Transiciones activas.** Al cambiar de tema hay `transition: background-color .3s`; se
  inyecta `* { transition: none !important; animation: none !important }` antes de ejecutar
  axe y se comprueba que `getComputedStyle(document.body).backgroundColor` es el del tema
  esperado (18,18,18 en oscuro) antes de leer el resultado.

Con esas dos precauciones la misma página pasa de 48 nodos «con violación» a 0.

## 10. Deuda conocida

- **Contraste de bordes y separadores** (1.4.11) no se audita
  automáticamente: `--border` se reforzó (`#dfe6ea` → `#3d566e` en oscuro) pero
  no hay guard para ello.
- **Textos sobre degradados**: axe los marca como «incompletos»; requieren
  revisión manual (hoy son dos: logo del login y tarjetas del panel).
- **Zoom al 200 % y espaciado de texto** (1.4.4, 1.4.12) no se midieron con
  herramienta; conviene añadirlos con Playwright.
- La verificación de contraste en CI es de tokens, no del DOM renderizado: un
  componente nuevo con colores literales puede escapar al guard. La norma de
  `docs/paridad-ui.md` (todo color sale de un token) es lo que lo evita.
