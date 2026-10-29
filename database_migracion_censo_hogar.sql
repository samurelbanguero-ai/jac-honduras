-- ============================================================
-- MIGRACIÓN: Censo — Hogar completo (miembros, vivienda ampliada,
-- necesidades prioritarias, movilidad, autorización y revisión)
-- JAC Honduras, Cauca
-- ------------------------------------------------------------
-- Este script es ADITIVO: no borra tablas ni datos existentes.
-- Requiere haber aplicado antes:
--   database_migracion_censo.sql
--   database_migracion_censo_vivienda.sql
-- Ejecutar conectado a la base: \c jac_honduras
-- ============================================================

-- ── Vivienda ampliada ─────────────────────────────────────────
ALTER TABLE censos ADD COLUMN IF NOT EXISTS zona_vivienda VARCHAR(50);
ALTER TABLE censos ADD COLUMN IF NOT EXISTS fuente_agua VARCHAR(50);
ALTER TABLE censos ADD COLUMN IF NOT EXISTS familias_hogar INTEGER;
ALTER TABLE censos ADD COLUMN IF NOT EXISTS acceso_recoleccion_residuos VARCHAR(10);
ALTER TABLE censos ADD COLUMN IF NOT EXISTS acceso_telefonia VARCHAR(10);

-- ── Salud (nivel hogar) ────────────────────────────────────────
ALTER TABLE censos ADD COLUMN IF NOT EXISTS acceso_servicios_salud VARCHAR(300);

-- ── Actividad económica familiar y movilidad ───────────────────
ALTER TABLE censos ADD COLUMN IF NOT EXISTS actividades_economicas_familia VARCHAR(300);
ALTER TABLE censos ADD COLUMN IF NOT EXISTS personas_ausentes INTEGER;
ALTER TABLE censos ADD COLUMN IF NOT EXISTS motivo_ausencia VARCHAR(50);
ALTER TABLE censos ADD COLUMN IF NOT EXISTS retorno_reciente VARCHAR(10);

-- ── Necesidades prioritarias ────────────────────────────────────
ALTER TABLE censos ADD COLUMN IF NOT EXISTS necesidades_prioritarias VARCHAR(500);

-- ── Autorización (reemplaza la firma física del formato en papel) ──
ALTER TABLE censos ADD COLUMN IF NOT EXISTS autorizacion BOOLEAN NOT NULL DEFAULT false;

-- ── Revisión por la Junta (reemplaza la firma de "autoridad/comité") ──
ALTER TABLE censos ADD COLUMN IF NOT EXISTS estado_revision VARCHAR(20) NOT NULL DEFAULT 'Pendiente';
ALTER TABLE censos ADD COLUMN IF NOT EXISTS revisado_por INTEGER REFERENCES admin(id);
ALTER TABLE censos ADD COLUMN IF NOT EXISTS revisado_en TIMESTAMP;

-- ── Miembros del hogar (registro de todas las personas, no solo el titular) ──
CREATE TABLE IF NOT EXISTS censo_miembros_hogar (
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
CREATE INDEX IF NOT EXISTS idx_censo_miembros_censo ON censo_miembros_hogar(censo_id);
