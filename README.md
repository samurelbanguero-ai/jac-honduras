# JAC Honduras, Cauca — Sistema de la Junta de Acción Comunal

Plataforma web de la Junta de Acción Comunal del corregimiento de Honduras (Cauca): noticias, afiliación en línea, carnet digital con QR, votaciones, PQRS, aportes, convites, documentos y censo comunitario.

- **Backend:** Node.js 20 + Express 4 + PostgreSQL 16
- **Frontend:** HTML, CSS y JavaScript sin frameworks, servido por el mismo backend
- **Despliegue:** Render + Neon + Cloudinary (gratis) o docker-compose en local

## Estructura

```
jac-honduras/
├── database.sql                     Esquema base (sin datos)
├── database_migracion_*.sql         Migraciones (comunidad, censo, vivienda, hogar)
├── database_datos_demo.sql          Datos de prueba — SOLO desarrollo local
├── Dockerfile                       Imagen de producción
├── docker-compose.yml               Entorno local (Postgres + backend con recarga)
├── render.yaml                      Blueprint de Render
├── backend/
│   ├── index.js                     Servidor, cabeceras de seguridad, límites, rutas
│   ├── config/                      db.js, mailer.js, seguridad.js
│   ├── controllers/                 Lógica de cada módulo
│   ├── middleware/                  auth.js (JWT y roles), validar.js
│   ├── routes/                      Rutas de la API y configuración de subidas
│   ├── utils/archivos.js            Archivos privados del censo y enlaces firmados
│   ├── scripts/                     migrate.js, crear-admin.js
│   └── uploads/                     Archivos subidos (privado/ = adjuntos del censo)
└── frontend/                        Páginas, estilos y scripts
```

## Puesta en marcha local

### Opción A: Docker (recomendada)

1. Copia `.env.example` a `.env` en la raíz y define `POSTGRES_PASSWORD`.
2. Copia `backend/.env.example` a `backend/.env` y define `JWT_SECRET` (mínimo 32 caracteres):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
3. Levanta todo:
   ```bash
   docker compose up --build
   ```
4. Abre http://localhost:3000. La base local se crea con los datos de demostración (`database_datos_demo.sql`).

### Opción B: Node y PostgreSQL instalados

```bash
psql -U postgres -c "CREATE DATABASE jac_honduras;"
cd backend
cp .env.example .env        # completa DB_* y JWT_SECRET
npm install
npm run migrate             # aplica el esquema en una base VACÍA
npm run crear-admin -- admin "una-contraseña-larga-y-segura"
npm run dev
```

> `npm run migrate` borra y recrea las tablas. Nunca lo ejecutes contra una base con datos reales.

## Administrador

No hay credenciales por defecto en producción. Crea o cambia el administrador de una de estas formas:

- **En Render (sin consola):** define la variable `ADMIN_PASSWORD` (mínimo 12 caracteres). Al arrancar, el servidor crea el usuario `ADMIN_USUARIO` (por defecto `admin`) o reemplaza la contraseña `admin123` si todavía existe.
- **Con acceso a la base:** `npm run crear-admin -- <usuario> "<contraseña>"`.

Con `NODE_ENV=production`, el servidor **bloquea** el inicio de sesión con `admin/admin123` y con los afiliados de prueba (cédula como contraseña).

El panel de administración está en `/panel-jac-2024`; se entra desde `/login` con el usuario del administrador.

## Recuperación de contraseña

En `/login` está el enlace **¿Olvidaste tu contraseña?**:

1. El afiliado escribe su cédula en `/recuperar`.
2. Si tiene correo registrado, recibe un enlace de un solo uso que vence en 30 minutos. La respuesta es la misma exista o no la cédula, para no revelar quién está afiliado.
3. En `/restablecer` crea la contraseña nueva. Los enlaces anteriores dejan de servir.

Requiere configurar `SMTP_*` (por ejemplo Gmail con una contraseña de aplicación). En desarrollo, sin SMTP, el enlace aparece en la consola del servidor para poder probarlo.

Quien no tenga correo registrado le pide a la Junta una contraseña temporal: el administrador la asigna con el botón **Resetear** del panel, y el afiliado la cambia después en su cuenta.

## Variables de entorno (backend)

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Cadena de conexión completa (Neon). Si existe, reemplaza a las `DB_*` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión a PostgreSQL (local) |
| `DB_SSL` | `true` para bases administradas (Render, Supabase) |
| `NODE_ENV` | `production` en el servidor publicado |
| `JWT_SECRET` | Obligatorio, mínimo 32 caracteres aleatorios |
| `JWT_EXPIRES` | Duración de la sesión del administrador (por defecto `1h`) |
| `ADMIN_USUARIO`, `ADMIN_PASSWORD` | Creación o rotación del administrador al arrancar |
| `CLOUDINARY_URL` | Guarda los archivos en Cloudinary. Vacío = disco local (`backend/uploads`) |
| `SITE_URL` | URL pública; se usa en el QR del carnet y en los correos |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Correos de recuperación de contraseña y avisos de noticias nuevas |
| `CORS_ORIGIN` | Solo si el frontend se sirve desde otro dominio |
| `TRUST_PROXY` | Saltos de proxy de confianza (por defecto 1 en producción) |

## Despliegue gratuito: Render + Neon + Cloudinary

| Pieza | Servicio | Por qué |
|---|---|---|
| Aplicación | Render (plan Free) | Despliega el `Dockerfile` desde GitHub |
| Base de datos | Neon (plan Free) | PostgreSQL que no vence (la de Render se borra a los 30 días) |
| Archivos | Cloudinary (plan Free) | El disco gratuito de Render se borra en cada redespliegue |

### 1. Neon (base de datos)
1. Crea una cuenta en neon.com y un proyecto (región: la más cercana, p. ej. AWS us-east-1).
2. En **Connect**, copia la cadena de conexión. Termina en `?sslmode=require`.

### 2. Cloudinary (archivos)
1. Crea una cuenta en cloudinary.com.
2. En **Settings > API Keys** copia la **API environment variable** (`cloudinary://...`).
3. En **Settings > Security**, activa **Allow delivery of PDF and ZIP files**. Sin esto, las cuentas gratuitas no entregan los PDF de las actas.

### 3. Render (aplicación)
1. Sube los cambios a GitHub.
2. En Render: **New > Blueprint**, elige el repositorio (usa `render.yaml`).
3. Completa las variables que pide:
   - `DATABASE_URL`: la cadena de Neon.
   - `CLOUDINARY_URL`: la de Cloudinary.
   - `ADMIN_PASSWORD`: la contraseña del administrador (mínimo 12 caracteres).
   - `SMTP_*`: necesarias para que lleguen los correos de recuperación de contraseña (y los avisos de noticias).
4. Despliega. En el primer arranque el servidor crea las tablas en Neon y el usuario `admin`.

### 4. Evitar que se duerma (opcional)
Render apaga el servicio gratis tras 15 minutos sin visitas; la siguiente visita tarda alrededor de un minuto. Para evitarlo:
1. Crea una cuenta en cron-job.org (gratis).
2. Programa una petición a `https://<tu-servicio>.onrender.com/api/ping` cada 10 minutos.

Usa `/api/ping` y **no** `/api/health`: `/api/ping` no consulta la base, así Neon puede apagarse cuando nadie usa el sitio y no se agotan sus 100 horas de cómputo gratuitas al mes.

### Si ya tenías la base de Render
La base gratuita de Render vence a los 30 días de creada. Para conservar los datos, expórtala antes y cárgala en Neon:
```bash
pg_dump "<URL externa de Render>" --no-owner --no-acl -f respaldo.sql
psql "<cadena de Neon>" -f respaldo.sql
```
Después borra la base de Render en el panel.

## Seguridad

- Contraseñas con bcrypt; mínimo 8 caracteres con letras y números para afiliados.
- JWT con roles (`admin` / `afiliado`) verificados en cada ruta protegida.
- Límites de peticiones en inicio de sesión, registro y verificación pública de carnets.
- Cabeceras de seguridad con Helmet (CSP, `nosniff`, `frame-ancestors 'none'`, HSTS en producción).
- Los adjuntos del censo son privados (en Cloudinary como archivos "authenticated"; en local, en `uploads/privado`) y solo se sirven con un enlace firmado que vence en 30 minutos. Al arrancar, los adjuntos antiguos que estaban en `uploads/` se mueven automáticamente a `uploads/privado`.
- El QR del carnet se genera en el servidor (la cédula no se envía a servicios externos).
- Chart.js se sirve desde el propio servidor, sin CDN.

## API principal

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/login` | Público (afiliado o admin) |
| POST | `/api/afiliados` | Público (registro) |
| POST | `/api/recuperar`, `/api/restablecer` | Público (recuperación de contraseña) |
| GET | `/api/afiliados/verificar/:cedula` | Público (QR del carnet) |
| GET/PUT | `/api/afiliados/perfil` | Afiliado |
| GET | `/api/afiliados/perfil/qr` | Afiliado |
| GET/PUT/DELETE | `/api/afiliados/:id` | Admin |
| GET | `/api/noticias` | Público (más noticias internas si hay sesión) |
| POST/DELETE | `/api/noticias` | Admin |
| * | `/api/comunidad/...` | Afiliado / Admin según la acción |
| * | `/api/censo/...` | Afiliado (su censo) / Admin (todos) |
| GET | `/api/health` | Público |
