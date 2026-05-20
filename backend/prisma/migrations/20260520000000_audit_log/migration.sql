-- audit_log: bitácora anti-fraude para modificaciones de reservas
CREATE TABLE IF NOT EXISTS audit_log (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad             VARCHAR(50)    NOT NULL,
  entidad_id          UUID           NOT NULL,
  accion              VARCHAR(50)    NOT NULL,
  campos_modificados  JSONB,
  actor_email         VARCHAR(255),
  actor_id            UUID,
  motivo              TEXT,
  created_at          TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_entidad_id_idx ON audit_log (entidad, entidad_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
