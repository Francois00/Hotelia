-- Migration: comprobantes (SUNAT electronic billing)

CREATE TABLE comprobantes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id    UUID NOT NULL REFERENCES reservas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  tipo          VARCHAR(10) NOT NULL,        -- BOLETA | FACTURA
  serie         VARCHAR(10) NOT NULL,
  correlativo   VARCHAR(10) NOT NULL,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  total         DECIMAL(10,2) NOT NULL,
  xml_generado  TEXT,
  cdr_respuesta TEXT,
  estado        VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',  -- EMITIDO | ERROR_SUNAT | PENDIENTE
  pdf_url       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX comprobantes_reserva_idx ON comprobantes(reserva_id);
CREATE INDEX comprobantes_estado_idx ON comprobantes(estado);
CREATE INDEX comprobantes_fecha_idx  ON comprobantes(fecha_emision);
