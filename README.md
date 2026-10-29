# 🌿 JAC Honduras, Cauca — Sistema de Gestión de Afiliados

Sistema web completo para la Junta de Acción Comunal de Honduras, Cauca.

---

## 📁 Estructura del Proyecto

```
jac-honduras/
├── database.sql                  ← Script SQL completo
├── backend/
│   ├── index.js                  ← Servidor Express (punto de entrada)
│   ├── package.json
│   ├── .env                      ← Variables de entorno (configurar)
│   ├── config/
│   │   └── db.js                 ← Conexión a PostgreSQL
│   ├── controllers/
│   │   ├── afiliadosController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   └── auth.js               ← Verificación JWT
│   └── routes/
│       ├── afiliados.js
│       └── admin.js
└── frontend/
    ├── index.html                ← Página de registro público
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── registro.js
    │   └── admin.js
    └── pages/
        └── admin.html            ← Panel del administrador
```

---

## ⚙️ Requisitos Previos

- **Node.js** v18 o superior → https://nodejs.org
- **PostgreSQL** v14 o superior → https://www.postgresql.org

---

## 🚀 Instalación Paso a Paso

### 1. Configurar la Base de Datos

Abre tu cliente de PostgreSQL (pgAdmin o terminal) y ejecuta:

```sql
-- Primero crea la base de datos
CREATE DATABASE jac_honduras;

-- Conéctate a ella
\c jac_honduras

-- Luego ejecuta el archivo completo
```

O desde la terminal:

```bash
psql -U postgres -f database.sql
```

> ⚠️ El script ya incluye 3 afiliados de prueba y el usuario admin.

---

### 2. Configurar Variables de Entorno

Edita el archivo `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jac_honduras
DB_USER=postgres
DB_PASSWORD=TU_CONTRASEÑA_AQUI   ← Cambia esto
PORT=3000
JWT_SECRET=jac_honduras_secret_2024
JWT_EXPIRES=1h
```

---

### 3. Instalar Dependencias del Backend

```bash
cd backend
npm install
```

---

### 4. Ejecutar el Servidor

```bash
# Modo normal
node index.js

# Modo desarrollo (auto-recarga al cambiar código)
npm run dev
```

Deberías ver en la terminal:
```
✅ Conectado a PostgreSQL - Base de datos: jac_honduras
🚀 Servidor corriendo en http://localhost:3000
```

---

### 5. Abrir en el Navegador

| Página | URL |
|--------|-----|
| Registro de Afiliados | http://localhost:3000 |
| Panel de Administrador | http://localhost:3000/admin |

---

## 🔐 Acceso de Administrador

| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | `admin123` |

---

## 🌐 Endpoints de la API

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/afiliados` | Registrar afiliado | No |
| GET | `/api/afiliados` | Listar todos | ✅ JWT |
| GET | `/api/afiliados/:id` | Obtener uno | ✅ JWT |
| PUT | `/api/afiliados/:id` | Actualizar | ✅ JWT |
| DELETE | `/api/afiliados/:id` | Eliminar | ✅ JWT |
| POST | `/api/admin/login` | Login admin | No |
| GET | `/api/admin/perfil` | Perfil admin | ✅ JWT |

---

## 🛠️ Solución de Problemas

**Error de conexión a PostgreSQL:**
- Verifica que PostgreSQL esté corriendo
- Confirma usuario y contraseña en el `.env`

**"bcrypt error" al hacer login:**
- Regenera el hash ejecutando en Node.js:
  ```js
  const b = require('bcrypt');
  console.log(await b.hash('admin123', 10));
  ```
  Y actualiza la tabla `admin` con el nuevo hash.

**El frontend no conecta al backend:**
- Verifica que el servidor esté corriendo en el puerto 3000
- Revisa la URL base `API` en los archivos JS del frontend

---

## 📋 Funcionalidades

✅ Registro público de afiliados con validación  
✅ Mensaje de felicitación al registrarse  
✅ Login de administrador con JWT  
✅ Panel admin con estadísticas por género  
✅ Tabla de afiliados con búsqueda en tiempo real  
✅ Editar y eliminar afiliados (solo admin)  
✅ Diseño responsive y moderno  
✅ Manejo de errores en frontend y backend  
