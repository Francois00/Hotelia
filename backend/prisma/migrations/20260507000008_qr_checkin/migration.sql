-- Migration: QR check-in columns on reservas

ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS qr_token       TEXT,
  ADD COLUMN IF NOT EXISTS qr_generado_en TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS reservas_qr_token_idx ON reservas(qr_token) WHERE qr_token IS NOT NULL;
