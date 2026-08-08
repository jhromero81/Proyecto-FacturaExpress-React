# FacturaExpress

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

> La documentación completa de la API (endpoints, métodos, parámetros y
> respuestas JSON) está en **`backend/README.md`** y el listado de endpoints
> para informes en **`ENDPOINTS.txt`**.

---

## Requisitos previos

- Node.js ≥ 18 (≥ 20.19 para el frontend con Vite 7)
- MySQL 8 corriendo localmente (o Docker para evitarlo)
- Git

---

## Opción A — Con Docker (recomendado)

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

## Opción B — Sin Docker (instalación manual)

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

En otra terminal, desde la raíz del proyecto:

```bash
npm install
cp .env.example .env   # opcional: cambiar VITE_API_URL
npm start              # Abre http://localhost:3000 (Vite dev server)
```

---

## Credenciales de acceso (usuarios de prueba)

| Rol       | NIT             | Contraseña      | Permisos                        |
| --------- | --------------- | --------------- | ------------------------------- |
| Admin     | `900.123.456-7` | `admin123`      | Acceso total                    |
| Vendedor  | `80.987.654-3`  | `vendedor123`   | Ventas y facturación            |
| Contador  | `70.555.444-2`  | `contador123`   | Reportes y facturas emitidas    |

---

## Scripts útiles (backend)

| Comando           | Descripción                                    |
| ----------------- | ---------------------------------------------- |
| `npm run db:setup`| Crea la base de datos, tablas y datos semilla. |
| `npm run db:seed` | Puebla datos de ejemplo (idempotente).         |
| `npm run db:migrate` | Aplica migraciones de esquema.             |

---

## Pruebas de la API

En `postman/` se incluye una colección de Postman con todas las peticiones de la
API organizadas por módulo (autenticación, clientes, productos, facturas,
reportes, etc.). También existe `postman/test-api.ps1` para probar vía consola.

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
- **Contraseñas cifradas** con bcrypt, consultas parametrizadas (anti-SQL
  injection) y CORS restringido al origen del frontend.

> En producción la cookie viaja con el atributo `Secure` (solo HTTPS). Esto se
> activa con `NODE_ENV=production` (configurado en `docker-compose.yml`).

---

## Control de versiones

```bash
git status
git add .
git commit -m "mensaje descriptivo"
git push -u origin master
```
