-- Migration: Módulos 07 (habitaciones CRUD), 01 (check-in manual), 03 (turnos)
-- Apply via: psql $DATABASE_URL -f this_file.sql

-- ─── Módulo 07: Tipos de habitación y reglas de temporada ────────────────────

-- Nuevos valores en MetodoPago
DO $$ BEGIN
  ALTER TYPE "MetodoPago" ADD VALUE IF NOT EXISTS 'YAPE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "MetodoPago" ADD VALUE IF NOT EXISTS 'PLIN';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nuevos valores en TipoDocumento
DO $$ BEGIN
  ALTER TYPE "TipoDocumento" ADD VALUE IF NOT EXISTS 'RUC';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "TipoDocumento" ADD VALUE IF NOT EXISTS 'DOC_EXTRANJERO';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nuevos enums
DO $$ BEGIN
  CREATE TYPE "TipoTemporada" AS ENUM (
    'TEMPORADA_ALTA', 'TEMPORADA_BAJA', 'FIN_DE_SEMANA', 'EVENTO_ESPECIAL', 'ESTADIA_LARGA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TipoTurno" AS ENUM ('DIA', 'NOCHE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoTurno" AS ENUM ('ABIERTO', 'CERRADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabla: tipos_habitacion (tipos personalizados además del enum TipoHabitacion)
CREATE TABLE IF NOT EXISTS tipos_habitacion (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(50)  NOT NULL,
  descripcion TEXT,
  color_mapa  VARCHAR(7)   NOT NULL DEFAULT '#3B82F6',
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Extender tabla habitaciones
ALTER TABLE habitaciones
  ADD COLUMN IF NOT EXISTS capacidad_adultos SMALLINT,
  ADD COLUMN IF NOT EXISTS capacidad_ninos   SMALLINT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tarifa_minima      DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS tarifa_maxima      DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS moneda_tarifa      VARCHAR(3)  NOT NULL DEFAULT 'PEN',
  ADD COLUMN IF NOT EXISTS fotos              JSONB       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS visible_otas       BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS tipo_custom_id     UUID        REFERENCES tipos_habitacion(id) ON DELETE SET NULL;

-- Tabla: reglas_temporada
CREATE TABLE IF NOT EXISTS reglas_temporada (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                VARCHAR(100)      NOT NULL,
  tipo                  "TipoTemporada"   NOT NULL,
  fecha_inicio          DATE,
  fecha_fin             DATE,
  ajuste_porcentaje     DECIMAL(5,2)      NOT NULL,
  estadia_minima_noches INTEGER,
  aplica_a_tipos        JSONB             NOT NULL DEFAULT '[]',
  activo                BOOLEAN           NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ─── Módulo 01: Check-in manual ───────────────────────────────────────────────

-- Extender tabla huespedes
ALTER TABLE huespedes
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_doc DATE;

-- Extender tabla reservas
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS tipo_comprobante        "TipoComprobante",
  ADD COLUMN IF NOT EXISTS datos_facturacion        JSONB,
  ADD COLUMN IF NOT EXISTS canal_envio_comprobante  VARCHAR(20) DEFAULT 'whatsapp';

-- ─── Módulo 03: Turnos de recepción ──────────────────────────────────────────

-- Tabla: turnos
CREATE TABLE IF NOT EXISTS turnos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo             "TipoTurno"   NOT NULL,
  recepcionista_id UUID          NOT NULL REFERENCES personal(id),
  fecha            DATE          NOT NULL DEFAULT CURRENT_DATE,
  hora_apertura    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  hora_cierre      TIMESTAMPTZ,
  saldo_inicial    DECIMAL(10,2) NOT NULL DEFAULT 0,
  saldo_final      DECIMAL(10,2),
  estado           "EstadoTurno" NOT NULL DEFAULT 'ABIERTO',
  firma_hash       VARCHAR(64),
  observaciones    TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Solo un turno ABIERTO a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_turnos_un_abierto
  ON turnos (estado)
  WHERE estado = 'ABIERTO';

CREATE INDEX IF NOT EXISTS idx_turnos_fecha   ON turnos (fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_estado  ON turnos (estado);

-- Tabla: gastos_caja
CREATE TABLE IF NOT EXISTS gastos_caja (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id              UUID          NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
  concepto              VARCHAR(200)  NOT NULL,
  monto                 DECIMAL(10,2) NOT NULL,
  comprobante_proveedor VARCHAR(50),
  registrado_por_id     UUID          NOT NULL REFERENCES personal(id),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gastos_caja_turno ON gastos_caja (turno_id);

-- Tabla: reporte_turno_cache
CREATE TABLE IF NOT EXISTS reporte_turno_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id     UUID        NOT NULL UNIQUE REFERENCES turnos(id) ON DELETE CASCADE,
  json_reporte JSONB       NOT NULL,
  pdf_url      TEXT,
  generado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
