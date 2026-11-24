-- ============================================================
-- MIGRACIÓN: aprobación de solicitudes de afiliación
-- Idempotente. Los afiliados que ya existían quedan como aprobados.
-- Los registros nuevos desde la página pública entran como 'pendiente'.
-- ============================================================
ALTER TABLE afiliados ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'aprobado';
ALTER TABLE afiliados ADD COLUMN IF NOT EXISTS solicitado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE afiliados ADD COLUMN IF NOT EXISTS revisado_en TIMESTAMPTZ;
ALTER TABLE afiliados ADD COLUMN IF NOT EXISTS revisado_por INTEGER REFERENCES admin(id) ON DELETE SET NULL;
ALTER TABLE afiliados ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;
CREATE INDEX IF NOT EXISTS idx_afiliados_estado ON afiliados(estado);
