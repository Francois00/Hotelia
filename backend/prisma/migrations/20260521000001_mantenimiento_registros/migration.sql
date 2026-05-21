-- M05: Mantenimiento por habitación
CREATE TABLE IF NOT EXISTS mantenimiento_registros (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  habitacion_id   UUID        NOT NULL REFERENCES habitaciones(id) ON DELETE CASCADE,
  tipo_problema   VARCHAR(30) NOT NULL
    CHECK (tipo_problema IN ('electrico','plomeria','mobiliario','climatizacion','limpieza_profunda','otro')),
  descripcion     TEXT        NOT NULL,
  tecnico_nombre  VARCHAR(100),
  fecha_inicio    TIMESTAMPTZ DEFAULT NOW(),
  fecha_fin       TIMESTAMPTZ,
  horas_fuera_servicio DECIMAL(6,2),
  costo_estimado  DECIMAL(10,2),
  estado          VARCHAR(20) DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','en_proceso','resuelto','cancelado')),
  prioridad       VARCHAR(10) DEFAULT 'media'
    CHECK (prioridad IN ('baja','media','alta','urgente')),
  reportado_por   UUID        REFERENCES personal(id) ON DELETE SET NULL,
  notas_cierre    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mantenimiento_habitacion ON mantenimiento_registros(habitacion_id);
CREATE INDEX IF NOT EXISTS idx_mantenimiento_estado ON mantenimiento_registros(estado);
