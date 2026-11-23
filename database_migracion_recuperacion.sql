-- ============================================================
-- MIGRACIÓN: recuperación de contraseña por correo
-- Idempotente: se puede ejecutar varias veces sin perder datos.
-- El servidor la aplica sola al arrancar.
-- ============================================================
CREATE TABLE IF NOT EXISTS recuperaciones_contrasena (
    id SERIAL PRIMARY KEY,
    afiliado_id INTEGER NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
    -- Solo se guarda el hash SHA-256 del código: si alguien lee la base, no puede usarlo.
    token_hash CHAR(64) NOT NULL UNIQUE,
    expira_en TIMESTAMPTZ NOT NULL,
    usado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recuperaciones_afiliado ON recuperaciones_contrasena(afiliado_id);
