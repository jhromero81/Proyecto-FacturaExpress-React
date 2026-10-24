# FacturaExpress

> **Alcance:** sistema de facturación **interna** con fines de demostración. Los
> comprobantes no son facturas electrónicas válidas ante la DIAN (el XML no es UBL 2.1 y no
> hay firma electrónica ni transmisión). Ver
> [`docs/fase-1-robustez.md`](docs/fase-1-robustez.md).

Sistema de facturación electrónica desarrollado como proyecto formativo SENA
(**Evidencia GA7-220501096-AA5-EV03**). Consta de dos partes:

- **Frontend** (React): interfaz de usuario para clientes, productos, ventas,
  facturación, reportes, configuración y administración.
- **Backend** (API REST): servicios web que conectan el sistema con la base de
  datos MySQL.

---

## Tecnologías y stack

| Componente           | Tecnología                             |
| -------------------- | -------------------------------------- |
| Frontend             | React 19 + React Router 7 + Vite       |
| Backend (API)        | Node.js + Express.js                   |
| Base de datos        | MySQL 8 (tablas relacionales)          |
| Autenticación        | JWT (jsonwebtoken) + bcryptjs          |
| Sesión segura        | Cookie httpOnly (cookie-parser)        |
| Cabeceras de seguridad | helmet                               |
| Límite de peticiones | express-rate-limit                     |
| Validación de entrada| express-validator                      |
| Variables de entorno | dotenv                                 |
| Infraestructura      | Docker / Docker Compose + GitHub Actions (CI) |
| Control de versiones | Git + GitHub                           |

---

## Estructura del proyecto

```
Proyecto-FacturaExpress-React/
├── backend/            # API REST (Node.js + Express + MySQL)
│   ├── README.md       # Documentación técnica de la API (endpoints, parámetros)
│   ├── Dockerfile      # Imagen Docker de la API
│   ├── server.js       # Punto de entrada del servidor
│   ├── routes/         # Definición de rutas por módulo
│   ├── controllers/    # Lógica de negocio
│   ├── config/         # Conexión a MySQL y configuración JWT
│   ├── middleware/     # Autenticación y manejo de errores
│   ├── db/             # Esquema SQL y datos de prueba
│   └── scripts/        # Creación de BD y datos semilla
├── .github/workflows/  # Integración continua (CI)
├── docker-compose.yml  # Levanta MySQL + API con un solo comando
├── index.html          # HTML raíz del frontend
├── vite.config.js      # Configuración de Vite
├── postman/            # Colección de pruebas de la API
└── src/                # Frontend React (componentes en .jsx)
    ├── pages/          # Pantallas (Login, Ventas, Facturación, etc.)
    ├── components/     # Componentes reutilizables
    ├── services/       # Consumo de la API
    └── context/        # Estado global (autenticación)
```
## Requisitos previos

- Node.js ≥ 18 (≥ 20.19 para el frontend con Vite 7)
- MySQL 8 corriendo localmente (o Docker para evitarlo)
- Git

---

## Opción A — Con Docker

Cree primero un archivo `.env` en la raíz con el secreto que firmará los
tokens JWT (la API **no arranca en producción sin él**):

```bash
# Windows (PowerShell):
$bytes = New-Object byte[] 48; [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
"JWT_SECRET=$([Convert]::ToBase64String($bytes))" | Set-Content .env

# Linux/macOS:
echo "JWT_SECRET=$(openssl rand -base64 48)" > .env
```

Levante MySQL 8 + la API REST con un solo comando:

```bash
docker compose up --build
```

La API queda disponible en `http://localhost:4000` (verifique
`http://localhost:4000/api/health`). La base de datos se crea y se puebla
automáticamente al arrancar.

Detener los contenedores:

```bash
docker compose down
```

## Opción B — Sin Docker

### Paso 1 — Configurar la base de datos y la API

```bash
cd backend
cp .env.example .env   # Windows: copy .env.example .env
```

Edite `.env` con las credenciales de su MySQL local (`DB_USER`, `DB_PASSWORD`).

Instale las dependencias y cree la base de datos con datos de ejemplo:

```bash
npm install
npm run db:setup       # Crea la BD, las tablas y los datos semilla
```

Inicie la API (queda en `http://localhost:4000`):

```bash
npm start              # Producción
npm run dev            # Desarrollo (nodemon)
```

Verifique con `http://localhost:4000/api/health`.

### Paso 2 — Iniciar el frontend

Desde la raíz del proyecto:

```bash
npm install
cp .env.example .env   # opcional: cambiar VITE_API_URL
npm start              # Vite dev server en http://localhost:3000
```

### Arranque rápido (API + frontend juntos)

Olvidarse de levantar la API produce el error *«No se pudo conectar con el
servidor. Verifique que la API esté en línea»* en todas las pantallas. Para
evitarlo, un solo comando levanta las dos piezas con los registros etiquetados
(`[api]` y `[web]`) y `Ctrl+C` detiene ambos:

```bash
npm run dev            # API en 4000 + frontend en 3000
PORT=4100 VITE_PORT=3100 npm run dev   # si esos puertos están ocupados
```

`npm start` sigue sirviendo para arrancar solo el frontend (útil cuando la API
ya corre en Docker, por ejemplo).

---

## Credenciales de acceso (usuarios de prueba)

Los tres usuarios del seed son **los mismos en esta versión y en la versión
Angular** (`FacturaExpress-V3`): ambas interfaces consumen la misma API y la
misma base de datos MySQL, así que no hay dos juegos de credenciales.

| Rol      | NIT (usuario)   | Nombre               | Permisos                     | Contraseña                                                   |
| -------- | --------------- | -------------------- | ---------------------------- | ------------------------------------------------------------ |
| Admin    | `900.123.456-7` | Jhon Henry Romero    | Acceso total                 | `SEED_ADMIN_PASSWORD` en `FacturaExpress-V3/backend/.env`     |
| Vendedor | `80.987.654-3`  | Maria Fernanda Lopez | Ventas y facturación         | `SEED_VENDEDOR_PASSWORD` en `FacturaExpress-V3/backend/.env`  |
| Contador | `70.555.444-2`  | Carlos Andres Ruiz   | Reportes y facturas emitidas | `SEED_CONTADOR_PASSWORD` en `FacturaExpress-V3/backend/.env`  |

> **No hay contraseñas por defecto escritas en el repositorio.** El seed toma el
> valor de esas variables o, si no están definidas, genera una aleatoria que
> imprime **una sola vez** por consola. Las contraseñas se guardan como hash
> bcrypt y no se pueden recuperar.
>
> Las contraseñas de este proyecto son las que quedaron sembradas en la base de
> datos compartida; por eso el valor vive en el `.env` del backend de V3.

Si no tiene el valor a mano:

```bash
cd backend
npm run usuario:clave -- --lista                  # ver NIT y rol de cada usuario
npm run usuario:clave -- --nit 900.123.456-7      # fijar una contraseña nueva
```

Sin `--password` la pide por consola sin mostrar lo tecleado (o genera una
aleatoria de 16 caracteres si no hay terminal). Opciones útiles:
`--password "<clave>"`, `--actualizar-env` (deja el valor en el `.env` de este
backend) y `--sync-angular` (además actualiza el de `FacturaExpress-V3`), pensado
para que ambos proyectos no queden con credenciales distintas.

La política de contraseñas es la misma que valida la versión Angular: mínimo 8
caracteres con minúscula, mayúscula y dígito.

---

## Scripts útiles (backend)

| Comando           | Descripción                                    |
| ----------------- | ---------------------------------------------- |
| `npm run db:setup`| Crea la base de datos, tablas y datos semilla. |
| `npm run db:seed` | Puebla datos de ejemplo (idempotente).         |
| `npm run db:migrate` | Aplica migraciones de esquema.             |
| `npm run usuario:clave -- --lista` | Lista los usuarios (NIT, rol, nombre, estado). |
| `npm run usuario:clave -- --nit <nit>` | Fija o restablece la contraseña de un usuario. |
| `npm test`        | Pruebas de humo de la API (supertest).          |

---

## Calidad y pruebas del frontend

El frontend tiene su propio conjunto de comprobaciones, ejecutable sin levantar
nada:

```bash
npm run check:tokens     # falla si un token CSS no está definido (paridad con Angular)
npm run check:contraste  # falla si un par texto/fondo baja de 4,5:1 en algún tema
npm test                 # pruebas unitarias: formatters, validators y modos (56 casos)
npm run check            # tokens + contraste + pruebas + build
```

- **Tokens CSS**: `src/styles/index.css` es copia fiel de la hoja global de la
  versión Angular. `scripts/check-tokens.mjs` impide que vuelva a quedarse sin
  definiciones, algo que degrada toda la interfaz sin dar ningún error.
- **Pruebas unitarias** con Vitest, espejo de los specs de Angular
  (`formatters.spec.ts` / `validators.spec.ts`) más las reglas de los modos de
  visualización (`preferences.test.js`): si una de las dos versiones cambia una
  regla, el CI lo delata.
- **Contraste AA en los tres temas**: `scripts/check-contraste.mjs` lee los
  bloques de tema del CSS global (claro, oscuro y alto contraste) y comprueba
  42 pares texto/fondo. Informe completo de la auditoría en
  [`docs/accesibilidad.md`](docs/accesibilidad.md).
- **Paridad visual**: procedimiento, tabla de resultados y trampas conocidas en
  [`docs/paridad-ui.md`](docs/paridad-ui.md).
- **Facturación robusta**: consecutivos sin repetición, stock con bloqueo de fila,
  anulación con nota crédito y medio de pago. Qué se corrigió, qué invariantes se
  sostienen y cómo verificarlo en [`docs/fase-1-robustez.md`](docs/fase-1-robustez.md).

Las rutas se cargan con `React.lazy`: el login ya no descarga el código de los
once módulos restantes (el chunk base pasó de 354 kB a 275 kB).

---

## Pruebas de la API

En `postman/` se incluye una colección de Postman con todas las peticiones de la
API organizadas por módulo (autenticación, clientes, productos, facturas,
reportes, etc.). También existe `postman/test-api.ps1` para probar vía consola.

Pruebas de humo automatizadas (sin abrir puerto ni exigir base de datos):

```bash
cd backend && npm test
```

Cubren salud del servicio, 404 en JSON, 401 en rutas protegidas, rechazo de
peticiones mutantes desde un origen ajeno (403) y permiso para el origen del
frontend.

Ejemplo rápido con cURL:

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nit":"900.123.456-7","password":"admin123"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).token")

curl -s http://localhost:4000/api/clientes -H "Authorization: Bearer $TOKEN"
```

---

## Integración continua (CI)

El repositorio incluye un workflow de GitHub Actions (`.github/workflows/ci.yml`)
que se ejecuta en cada push o pull request:

- **Backend**: verifica la sintaxis de todos los archivos, crea la base de datos
  contra una instancia real de MySQL 8 y arranca la API probando: el endpoint de
  salud, un login + consulta protegida (con `Authorization: Bearer` y con cookie
  httpOnly), la validación de entrada (400), el rechazo sin sesión (401) y el
  límite de intentos de login (429).
- **Frontend**: instala dependencias y construye la aplicación con Vite.

---

## Seguridad

Medidas implementadas en la API (ver `backend/README.md` → *Seguridad*):

- **Cookie de sesión httpOnly** (`SameSite=Lax`): el token JWT no es accesible
  desde JavaScript, lo que mitiga ataques XSS. El frontend no almacena el token.
- **Helmet**: cabeceras HTTP de seguridad (CSP, X-Frame-Options, HSTS, etc.).
- **Límite de intentos**: login bloqueado tras 5 intentos/15 min por IP; la API
  general limita a 120 peticiones/min.
- **Validación de entrada** en el servidor con `express-validator` (respuesta
  400 con la lista de campos inválidos).
- **Errores sin detalles internos en producción**: los errores 500 devuelven un
  mensaje genérico; el detalle solo queda en los logs.
- **Secreto JWT obligatorio en producción** (`JWT_SECRET`): la API se detiene si
  no está configurado.
- **Control de origen en peticiones mutantes**: con la sesión en cookie, un
  `POST`/`PUT`/`PATCH`/`DELETE` que llegue desde un origen no autorizado se
  rechaza con 403 aunque la cookie viaje. Los orígenes se configuran en
  `CORS_ORIGIN` y `CORS_ORIGINS` (el 4200 corresponde a la versión Angular).
- **`TRUST_PROXY`**: activarlo solo detrás de nginx, para que el límite de
  peticiones use la IP real del cliente y no la del proxy.
- **Contraseñas cifradas** con bcrypt, consultas parametrizadas (anti-SQL
  injection) y CORS restringido al origen del frontend.

> En producción la cookie viaja con el atributo `Secure` (solo HTTPS). Esto se
> activa con `NODE_ENV=production` (configurado en `docker-compose.yml`).

---
