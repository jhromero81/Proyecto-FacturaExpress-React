# Fase 1 — Robustez del sistema de facturación

Documento de la primera fase del plan de mejora: cerrar los huecos que hacían que el
sistema **pareciera** más de lo que era. No toca la integración fiscal real (fase 2); corrige
los mecanismos internos que producían datos incorrectos o etiquetas engañosas.

## Qué se corrigió y por qué

| Antes | Riesgo real | Ahora |
| --- | --- | --- |
| Numeración `COUNT(*) + 1` por mes | Dos ventas simultáneas obtenían el mismo número; al borrar una factura el consecutivo retrocedía y chocaba con el `UNIQUE` (error 500) | Tabla `consecutivos` con upsert atómico dentro de la transacción. El número no se repite ni retrocede |
| Stock validado fuera de la transacción | Se podía **sobrevender**: la validación y el descuento no eran la misma operación | `SELECT … FOR UPDATE` sobre los productos y validación dentro de la transacción; cantidades agregadas por producto |
| `DELETE /api/facturas/:id` | Borraba el documento fiscal y dejaba el inventario descuadrado | Responde 409. La anulación va por nota crédito: guarda motivo y usuario, devuelve el stock y conserva la factura |
| Badge «DIAN SINCRONIZADO» y «MOTOR FISCAL ACTIVO» | Hacía creer que se había emitido un documento válido ante la DIAN | «MODO DEMOSTRACIÓN» y «SIN MOTOR FISCAL»; el PDF y el XML llevan leyenda de demostración |
| Sin medio de pago ni vencimiento | Una venta a crédito era indistinguible de una de contado; no había cartera posible | `medio_pago`, `plazo_dias` y `fecha_vencimiento` calculada en el servidor |
| `window.confirm` tras finalizar la venta | Bloquea el hilo de JavaScript y no es accesible para lectores de pantalla | Aviso `role="status"` con enlace a «Ver historial» |

## Invariantes que ahora sostiene el backend

1. **Un número, una factura.** El consecutivo se incrementa en la misma transacción que
   inserta el documento. Si la transacción revierte, el número también.
2. **No se sobrevende.** El stock se lee con bloqueo de fila y se descuenta antes del
   `COMMIT`. La prueba de concurrencia lo verifica con dos peticiones simultáneas del último
   artículo: exactamente una responde 201 y la otra 409.
3. **Nada se borra.** Factura, items y nota crédito quedan como rastro. La única forma de
   anular es una nota crédito con motivo (≥ 5 caracteres) y usuario.
4. **Una factura anulada es definitiva.** No cambia de estado ni admite una segunda
   anulación (409 en ambos casos).
5. **Los importes los calcula el servidor.** Subtotal, descuento, IVA y total se recalculan
   a partir del precio en base de datos; el cliente solo envía cantidades y el descuento.

## Medios de pago

| Valor | Etiqueta | Plazo |
| --- | --- | --- |
| `efectivo` | Efectivo | — |
| `tarjeta` | Tarjeta | — |
| `transferencia` | Transferencia | — |
| `credito` | Crédito | 1–365 días; `fecha_vencimiento` se calcula en el servidor |

El plazo solo se guarda cuando el medio es `credito`; en el resto se fuerza a 0 para que no
queden vencimientos fantasma.

## Cómo verificarlo

```bash
# 1. Migración (columnas y tablas nuevas)
cd backend && npm run db:migrate

# 2. Pruebas del flujo completo contra la base de datos
npm test        # 21 pruebas: totales, consecutivo, concurrencia, anulación, DELETE 409

# 3. Frontend: paridad, tokens, contraste y pruebas unitarias
cd .. && npm run check && npm test
```

Resultados de la verificación de esta fase (23/10/2026):

- **Backend: 21/21** pruebas, incluidas concurrencia y nota crédito.
- **Frontend: 56/56** pruebas Vitest; `check:tokens` 33 tokens; `check:contraste` 45 pares.
- **Paridad React ↔ Angular a 1440×900:** ventas 0,00 %, facturación 0,03 %, modal de
  detalle 0,00 %, modal de anulación 0,07 % (misma geometría: 460×376 en las dos).
- **Accesibilidad:** axe-core 4.10.2 sin violaciones en las 18 mediciones (2 apps × 3 temas
  × ventas / facturación / modal de anulación).

Detalle metodológico: axe debe ejecutarse con la pestaña **visible** (`Page.bringToFront`) y
con las transiciones desactivadas. Con la pestaña en segundo plano las transiciones de
`background-color` no avanzan y el tema oscuro se mide a medio camino, lo que produce falsos
positivos de contraste (se observaron 48 nodos que desaparecen al medir bien).

## Lo que deja para la fase 2

Esto sigue siendo un sistema de facturación **interna**: el XML es propio (no UBL 2.1), el
CUFE es un SHA-256 de una cadena interna, no hay firma electrónica ni envío a la DIAN, y el
IVA es una tarifa global del 19 %. Una factura electrónica válida en Colombia exige un
proveedor tecnológico habilitado; reimplementarlo aquí no es el camino.
