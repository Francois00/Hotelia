-- reviews_nlp: NLP-analysed guest reviews (separate from OTA reviews table)
CREATE TABLE IF NOT EXISTS reviews_nlp (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  huesped_id    UUID        REFERENCES huespedes(id) ON UPDATE CASCADE ON DELETE SET NULL,
  habitacion_id UUID        REFERENCES habitaciones(id) ON UPDATE CASCADE ON DELETE SET NULL,
  fuente        VARCHAR(30) NOT NULL,
  texto_original TEXT       NOT NULL,
  idioma        VARCHAR(10),
  score_general DECIMAL(4,3),
  aspectos      JSONB       DEFAULT '[]',
  procesado     BOOLEAN     DEFAULT TRUE,
  fecha_review  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reviews_nlp_habitacion_id_idx ON reviews_nlp(habitacion_id);
CREATE INDEX IF NOT EXISTS reviews_nlp_huesped_id_idx    ON reviews_nlp(huesped_id);
CREATE INDEX IF NOT EXISTS reviews_nlp_fecha_review_idx  ON reviews_nlp(fecha_review);

-- alertas_mantenimiento: recurring problems and maintenance flags
CREATE TABLE IF NOT EXISTS alertas_mantenimiento (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  habitacion_id UUID        NOT NULL REFERENCES habitaciones(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tipo          VARCHAR(50) NOT NULL,
  descripcion   TEXT        NOT NULL,
  frecuencia    INTEGER     DEFAULT 1,
  nivel_alerta  VARCHAR(10) NOT NULL,
  activa        BOOLEAN     DEFAULT TRUE,
  resuelta_en   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alertas_mantenimiento_habitacion_idx ON alertas_mantenimiento(habitacion_id);
CREATE INDEX IF NOT EXISTS alertas_mantenimiento_activa_idx     ON alertas_mantenimiento(activa);

-- Unique constraint for upsert logic
CREATE UNIQUE INDEX IF NOT EXISTS alertas_mantenimiento_uniq_active
  ON alertas_mantenimiento(habitacion_id, tipo, descripcion)
  WHERE activa = TRUE;
