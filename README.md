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
| Frontend             | React 19 + React Router 7 + CSS        |
| Backend (API)        | Node.js + Express.js                   |
| Base de datos        | MySQL 8 (tablas relacionales)          |
| Autenticación        | JWT (jsonwebtoken) + bcryptjs          |
| Variables de entorno | dotenv                                 |
| Control de versiones | Git + GitHub                           |

---

## Estructura del proyecto

```
Proyecto-FacturaExpress-React/
├── backend/            # API REST (Node.js + Express + MySQL)
│   ├── README.md       # Documentación técnica de la API (endpoints, parámetros)
│   ├── server.js       # Punto de entrada del servidor
│   ├── routes/         # Definición de rutas por módulo
│   ├── controllers/    # Lógica de negocio
│   ├── config/         # Conexión a MySQL y configuración JWT
│   ├── middleware/     # Autenticación y manejo de errores
│   ├── db/             # Esquema SQL y datos de prueba
│   └── scripts/        # Creación de BD y datos semilla
├── postman/            # Colección de pruebas de la API
└── src/                # Frontend React
    ├── pages/          # Pantallas (Login, Ventas, Facturación, etc.)
    ├── components/     # Componentes reutilizables
    ├── services/       # Consumo de la API
    └── context/        # Estado global (autenticación)
```

> La documentación completa de la API (endpoints, métodos, parámetros y
> respuestas JSON) está en **`backend/README.md`**.

---

## Requisitos previos

- Node.js ≥ 18
- MySQL 8 corriendo localmente
- Git

---

## Instalación y puesta en marcha

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
npm start              # Abre http://localhost:3000
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

## Control de versiones

```bash
git status
git add .
git commit -m "mensaje descriptivo"
git push -u origin master
```
