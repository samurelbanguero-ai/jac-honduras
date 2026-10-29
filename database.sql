-- ============================================================
-- BASE DE DATOS: Junta de Accion Comunal - Honduras, Cauca
-- ============================================================

-- 1) Crear base de datos (como superusuario de PostgreSQL):
CREATE DATABASE jac_honduras;

-- 2) Conectarse: \c jac_honduras
-- 3) Ejecutar el resto de este script

-- ============================================================
-- TABLA: admin
-- ============================================================
DROP TABLE IF EXISTS admin CASCADE;
CREATE TABLE admin (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    nombre VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLA: afiliados
-- ============================================================
DROP TABLE IF EXISTS afiliados CASCADE;
CREATE TABLE afiliados (
    id SERIAL PRIMARY KEY,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    cedula VARCHAR(20) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    fecha_expedicion DATE NOT NULL,
    genero VARCHAR(20) NOT NULL,
    etnia VARCHAR(50),
    discapacidad VARCHAR(100) DEFAULT 'Ninguna',
    fecha_afiliacion DATE NOT NULL DEFAULT CURRENT_DATE,
    telefono VARCHAR(20),
    correo VARCHAR(100),
    foto_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLA: noticias
-- ============================================================
DROP TABLE IF EXISTS noticias CASCADE;
CREATE TABLE noticias (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    contenido TEXT NOT NULL,
    imagen_url VARCHAR(500),
    autor_admin_id INTEGER REFERENCES admin(id),
    fecha_publicacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    solo_afiliados BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- TABLA: encuestas / votos
-- ============================================================
DROP TABLE IF EXISTS votos CASCADE;
DROP TABLE IF EXISTS encuestas CASCADE;
CREATE TABLE encuestas (
    id SERIAL PRIMARY KEY,
    pregunta TEXT NOT NULL,
    opcion_a VARCHAR(200) NOT NULL,
    opcion_b VARCHAR(200) NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT true,
    creado_por INTEGER REFERENCES admin(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE votos (
    id SERIAL PRIMARY KEY,
    encuesta_id INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
    afiliado_id INTEGER NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
    opcion CHAR(1) NOT NULL CHECK (opcion IN ('A', 'B')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (encuesta_id, afiliado_id)
);

-- ============================================================
-- TABLA: pqrs
-- ============================================================
DROP TABLE IF EXISTS pqrs CASCADE;
CREATE TABLE pqrs (
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

-- ============================================================
-- TABLA: aportes
-- ============================================================
DROP TABLE IF EXISTS aportes CASCADE;
CREATE TABLE aportes (
    id SERIAL PRIMARY KEY,
    afiliado_id INTEGER NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
    concepto VARCHAR(200) NOT NULL,
    valor NUMERIC(12, 2) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pagado',
    registrado_por INTEGER REFERENCES admin(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLA: eventos / inscritos_eventos
-- ============================================================
DROP TABLE IF EXISTS inscritos_eventos CASCADE;
DROP TABLE IF EXISTS eventos CASCADE;
CREATE TABLE eventos (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha TIMESTAMP NOT NULL,
    lugar VARCHAR(200),
    creado_por INTEGER REFERENCES admin(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE inscritos_eventos (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    afiliado_id INTEGER NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (evento_id, afiliado_id)
);

-- ============================================================
-- TABLA: documentos
-- ============================================================
DROP TABLE IF EXISTS documentos CASCADE;
CREATE TABLE documentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    archivo_url VARCHAR(500) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'Otro',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subido_por INTEGER REFERENCES admin(id)
);

-- ============================================================
-- TABLA: notificaciones / notificaciones_leidas
-- ============================================================
DROP TABLE IF EXISTS notificaciones_leidas CASCADE;
DROP TABLE IF EXISTS notificaciones CASCADE;
CREATE TABLE notificaciones (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    creado_por INTEGER REFERENCES admin(id),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE notificaciones_leidas (
    id SERIAL PRIMARY KEY,
    notificacion_id INTEGER NOT NULL REFERENCES notificaciones(id) ON DELETE CASCADE,
    afiliado_id INTEGER NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (notificacion_id, afiliado_id)
);

-- ============================================================
-- TABLA: censos
-- ============================================================
-- Un afiliado tiene, a lo sumo, un (1) censo propio (UNIQUE afiliado_id).
DROP TABLE IF EXISTS censos CASCADE;
CREATE TABLE censos (
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
    zona_vivienda VARCHAR(50), -- Territorio comunitario / Zona urbana / Zona rural / Resguardo o territorio colectivo / Otro
    tipo_vivienda VARCHAR(50), -- Tenencia de la vivienda: Propia / Alquilada / Prestada / Otra
    personas_hogar INTEGER,
    familias_hogar INTEGER,

    -- Materiales de construcción de la vivienda
    material_paredes VARCHAR(50),
    material_piso VARCHAR(50),
    material_techo VARCHAR(50),

    -- Servicios básicos
    acceso_agua_potable VARCHAR(10),
    fuente_agua VARCHAR(50),
    acceso_electricidad VARCHAR(10),
    acceso_gas VARCHAR(10),
    sistema_excretas VARCHAR(50),
    acceso_recoleccion_residuos VARCHAR(10),
    acceso_telefonia VARCHAR(10),

    -- Disponibilidad de tecnología (lista separada por comas, ej: "Internet, Televisor")
    tecnologia_disponible VARCHAR(300),

    -- Salud (nivel hogar)
    acceso_servicios_salud VARCHAR(300),

    -- Actividad económica familiar y movilidad
    actividades_economicas_familia VARCHAR(300),
    personas_ausentes INTEGER,
    motivo_ausencia VARCHAR(50),
    retorno_reciente VARCHAR(10),

    -- Necesidades prioritarias de la familia (lista separada por comas)
    necesidades_prioritarias VARCHAR(500),

    -- Contacto
    telefono VARCHAR(20),
    correo VARCHAR(100),

    -- Información socioeconómica
    nivel_educativo VARCHAR(50),
    ocupacion VARCHAR(100),
    observaciones TEXT,

    -- Autorización (reemplaza la firma física del formato en papel)
    autorizacion BOOLEAN NOT NULL DEFAULT false,

    -- Revisión por la Junta (reemplaza la firma de "autoridad/comité")
    estado_revision VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    revisado_por INTEGER REFERENCES admin(id),
    revisado_en TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_censos_ciudad ON censos(ciudad_municipio);
CREATE INDEX idx_censos_sexo ON censos(sexo);
CREATE INDEX idx_censos_ocupacion ON censos(ocupacion);
CREATE INDEX idx_censos_documento ON censos(numero_documento);

-- ============================================================
-- TABLA: censo_archivos (fotos/documentos adjuntos a un censo)
-- ============================================================
DROP TABLE IF EXISTS censo_archivos CASCADE;
CREATE TABLE censo_archivos (
    id SERIAL PRIMARY KEY,
    censo_id INTEGER NOT NULL REFERENCES censos(id) ON DELETE CASCADE,
    nombre_original VARCHAR(255),
    archivo_url VARCHAR(500) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'Otro',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_censo_archivos_censo ON censo_archivos(censo_id);

-- ============================================================
-- TABLA: censo_miembros_hogar (registro de todas las personas del hogar)
-- ============================================================
DROP TABLE IF EXISTS censo_miembros_hogar CASCADE;
CREATE TABLE censo_miembros_hogar (
    id SERIAL PRIMARY KEY,
    censo_id INTEGER NOT NULL REFERENCES censos(id) ON DELETE CASCADE,

    nombre_completo VARCHAR(150) NOT NULL,
    parentesco VARCHAR(50) NOT NULL,
    sexo VARCHAR(30) NOT NULL,
    fecha_nacimiento DATE,
    estado_civil VARCHAR(30),
    vive_aqui BOOLEAN NOT NULL DEFAULT true,

    sabe_leer_escribir VARCHAR(10),
    nivel_educativo VARCHAR(50),
    estudia_actualmente VARCHAR(10),
    institucion_educativa VARCHAR(150),

    tiene_discapacidad VARCHAR(10),
    tipo_discapacidad VARCHAR(50),

    habla_lengua_propia VARCHAR(40),
    participa_actividades_culturales VARCHAR(20),

    trabaja_actualmente VARCHAR(10),
    actividad_economica VARCHAR(100),
    lugar_trabajo VARCHAR(150),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_censo_miembros_censo ON censo_miembros_hogar(censo_id);

-- ============================================================
-- DATOS DE PRUEBA
-- ============================================================
-- Nota: La contraseña para estos datos de prueba es la misma cédula (hasheada con bcrypt).
INSERT INTO afiliados (nombres, apellidos, cedula, contrasena, fecha_expedicion, genero, etnia, discapacidad, fecha_afiliacion, telefono, correo)
VALUES
    ('Carlos Andres', 'Munoz Lopez', '1234567890', '$2a$10$EwR04m2p4VjQ.yX0U3B/OOWuT21XJzEwDXX2aL1I31kXXf.E.K8S2', '2010-03-15', 'Masculino', 'Mestizo', 'Ninguna', '2024-01-10', '3201234567', 'carlos.munoz@correo.com'),
    ('Maria Fernanda', 'Gomez Torres', '0987654321', '$2a$10$wE/.7UqLgE7Z4C8k25H4bOgZ51E6.AQQbLqXX1EewXZK.xYQdF71K', '2008-07-22', 'Femenino', 'Afrodescendiente', 'Ninguna', '2024-02-14', '3157654321', 'maria.gomez@correo.com'),
    ('Luis Eduardo', 'Ramos Perez', '1122334455', '$2a$10$X8a.jJbH30O2VvS21x3H8.3.uH5EaW1.y9/tZ1/qC3QXX2KqQvQKC', '2005-11-05', 'Masculino', 'Indigena', 'Visual leve', '2024-03-20', '3009988776', 'luis.ramos@correo.com');

-- ============================================================
-- ADMIN: usuario=admin | contrasena=admin123
-- ============================================================
INSERT INTO admin (usuario, contrasena, nombre)
VALUES ('admin', '$2a$10$xHXBeV4Gx9h1idw3Wt2vB.Gzl1VCX0zkwER1LFSmzMYjXG2XXWi6y', 'Administrador JAC');
