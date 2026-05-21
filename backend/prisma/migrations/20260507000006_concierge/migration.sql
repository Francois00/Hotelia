-- concierge_mensajes: chatbot conversation history per guest
CREATE TABLE IF NOT EXISTS concierge_mensajes (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  huesped_id       UUID         NOT NULL REFERENCES huespedes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  reserva_id       UUID         REFERENCES reservas(id) ON UPDATE CASCADE ON DELETE SET NULL,
  mensaje_huesped  TEXT         NOT NULL,
  respuesta_aria   TEXT,
  intent_detectado VARCHAR(50),
  escalado         BOOLEAN      DEFAULT FALSE,
  escalado_motivo  VARCHAR(200),
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS concierge_mensajes_huesped_id_idx ON concierge_mensajes(huesped_id);
CREATE INDEX IF NOT EXISTS concierge_mensajes_escalado_idx   ON concierge_mensajes(escalado);
