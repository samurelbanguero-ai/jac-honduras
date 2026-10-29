-- ============================================================
-- MIGRACIÓN: Módulo Comunidad (Panel de Usuario y Administrador)
-- JAC Honduras, Cauca
-- ------------------------------------------------------------
-- Este script es ADITIVO: no borra tablas ni datos existentes.
-- Seguro de ejecutar sobre la base de datos "jac_honduras" ya
-- en uso. Ejecutar conectado a la base: \c jac_honduras
-- ============================================================

-- Foto de perfil del afiliado
ALTER TABLE afiliados ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500);

-- ── Encuestas / Votos ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS encuestas (
    id SERIAL PRIMARY KEY,
    pregunta TEXT NOT NULL,
    opcion_a VARCHAR(200) NOT NULL,
    opcion_b VARCHAR(200) NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT true,
    creado_por INTEGER REFERENCES admin(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS votos (
    id SERIAL PRIMARY KEY,
    encuesta_id INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
    afiliado_id INTEGER NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
    opcion CHAR(1) NOT NULL CHECK (opcion IN ('A', 'B')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (encuesta_id, afiliado_id)
);

-- ── PQRS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pqrs (
    id SERIAL PRIMARY KEY,
    afiliado_id INTEGER NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL DEFAULT 'Peticion',
    asunto VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    respuesta TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta TIMESTAMP
);

-- ── Aportes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aportes (
    id SERIAL PRIMARY KEY,
    afiliado_id INTEGER NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
    concepto VARCHAR(200) NOT NULL,
    valor NUMERIC(12, 2) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pagado',
    registrado_por INTEGER REFERENCES admin(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Eventos / Voluntariado ───────────────────────────────────
CREATE TABLE IF NOT EXISTS eventos (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha TIMESTAMP NOT NULL,
    lugar VARCHAR(200),
    creado_por INTEGER REFERENCES admin(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inscritos_eventos (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    afiliado_id INTEGER NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (evento_id, afiliado_id)
);

-- ── Documentos / Actas ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    archivo_url VARCHAR(500) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'Otro',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subido_por INTEGER REFERENCES admin(id)
);

-- ── Notificaciones ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    creado_por INTEGER REFERENCES admin(id),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notificaciones_leidas (
    id SERIAL PRIMARY KEY,
    notificacion_id INTEGER NOT NULL REFERENCES notificaciones(id) ON DELETE CASCADE,
    afiliado_id INTEGER NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (notificacion_id, afiliado_id)
);
