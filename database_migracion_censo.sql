-- ============================================================
-- MIGRACIÓN: Módulo Censo (Panel de Usuario y Administrador)
-- JAC Honduras, Cauca
-- ------------------------------------------------------------
-- Este script es ADITIVO: no borra tablas ni datos existentes.
-- Seguro de ejecutar sobre la base de datos "jac_honduras" ya
-- en uso. Ejecutar conectado a la base: \c jac_honduras
-- ============================================================

-- Un afiliado tiene, a lo sumo, un (1) censo propio (UNIQUE afiliado_id).
CREATE TABLE IF NOT EXISTS censos (
    id SERIAL PRIMARY KEY,
    afiliado_id INTEGER NOT NULL UNIQUE REFERENCES afiliados(id) ON DELETE CASCADE,

    -- Datos personales
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    tipo_documento VARCHAR(30) NOT NULL DEFAULT 'Cedula de Ciudadania',
    numero_documento VARCHAR(20) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    sexo VARCHAR(20) NOT NULL,
    estado_civil VARCHAR(30),
    etnia VARCHAR(50),
    discapacidad VARCHAR(100) DEFAULT 'Ninguna',

    -- Ubicación y vivienda
    direccion VARCHAR(200),
    barrio_vereda VARCHAR(100),
    ciudad_municipio VARCHAR(100) NOT NULL,
    tipo_vivienda VARCHAR(50),
    personas_hogar INTEGER,

    -- Contacto
    telefono VARCHAR(20),
    correo VARCHAR(100),

    -- Información socioeconómica
    nivel_educativo VARCHAR(50),
    ocupacion VARCHAR(100),
    observaciones TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_censos_ciudad ON censos(ciudad_municipio);
CREATE INDEX IF NOT EXISTS idx_censos_sexo ON censos(sexo);
CREATE INDEX IF NOT EXISTS idx_censos_ocupacion ON censos(ocupacion);
CREATE INDEX IF NOT EXISTS idx_censos_documento ON censos(numero_documento);
