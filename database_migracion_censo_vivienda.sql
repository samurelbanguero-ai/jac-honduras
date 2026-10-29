-- ============================================================
-- MIGRACIÓN: Censo — Vivienda, Servicios Básicos, Tecnología y Archivos
-- JAC Honduras, Cauca
-- ------------------------------------------------------------
-- Este script es ADITIVO: no borra tablas ni datos existentes.
-- Requiere haber aplicado antes database_migracion_censo.sql
-- Ejecutar conectado a la base: \c jac_honduras
-- ============================================================

-- Materiales de construcción de la vivienda
ALTER TABLE censos ADD COLUMN IF NOT EXISTS material_paredes VARCHAR(50);
ALTER TABLE censos ADD COLUMN IF NOT EXISTS material_piso VARCHAR(50);
ALTER TABLE censos ADD COLUMN IF NOT EXISTS material_techo VARCHAR(50);

-- Servicios básicos
ALTER TABLE censos ADD COLUMN IF NOT EXISTS acceso_agua_potable VARCHAR(10);
ALTER TABLE censos ADD COLUMN IF NOT EXISTS acceso_electricidad VARCHAR(10);
ALTER TABLE censos ADD COLUMN IF NOT EXISTS acceso_gas VARCHAR(10);
ALTER TABLE censos ADD COLUMN IF NOT EXISTS sistema_excretas VARCHAR(50);

-- Disponibilidad de tecnología (lista separada por comas, ej: "Internet, Televisor")
ALTER TABLE censos ADD COLUMN IF NOT EXISTS tecnologia_disponible VARCHAR(300);

-- Nota: "tipo_vivienda" (ya existente) se reutiliza como "Tenencia de la Vivienda"
-- (Propia / Alquilada / Prestada / Otra); no requiere cambio de esquema.

-- ── Archivos adjuntos del censo (fotos, documentos) ──────────
-- El propietario (afiliado) solo puede subir/ver/eliminar los archivos
-- de SU PROPIO censo (validado por join con censos.afiliado_id en el backend).
-- El admin puede ver y eliminar los archivos de cualquier censo.
CREATE TABLE IF NOT EXISTS censo_archivos (
    id SERIAL PRIMARY KEY,
    censo_id INTEGER NOT NULL REFERENCES censos(id) ON DELETE CASCADE,
    nombre_original VARCHAR(255),
    archivo_url VARCHAR(500) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'Otro',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_censo_archivos_censo ON censo_archivos(censo_id);
