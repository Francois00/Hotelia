-- Migración manual, additive-only, para las Partes 1-7 del sprint.
-- Generada a mano a partir de `prisma migrate diff`, filtrando SOLO lo nuevo:
-- el diff completo incluía DROP TABLE de almacen_articulos, mantenimiento_registros,
-- reviews_nlp, solicitudes_huesped, campanas_envios, encuestas_satisfaccion (existen
-- en la BD con datos reales pero no están en schema.prisma) — NO se ejecuta esa parte.

-- Parte 1 / Parte 4 — ubicacion_descripcion en habitaciones
ALTER TABLE "habitaciones" ADD COLUMN IF NOT EXISTS "ubicacion_descripcion" VARCHAR(100);

-- Parte 3 — Channel Manager iCal
CREATE TABLE IF NOT EXISTS "ical_conexiones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "habitacion_id" UUID NOT NULL,
    "canal" "CanalSync" NOT NULL,
    "ical_url_externa" TEXT,
    "ical_token_propio" VARCHAR(64) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    "ultima_sync" TIMESTAMPTZ(3),
    "ultimo_error" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ical_conexiones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ical_bloqueos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "habitacion_id" UUID NOT NULL,
    "canal" "CanalSync" NOT NULL,
    "fecha_entrada" DATE NOT NULL,
    "fecha_salida" DATE NOT NULL,
    "uid_externo" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ical_bloqueos_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "ical_conexiones_ical_token_propio_key" ON "ical_conexiones"("ical_token_propio");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  CREATE INDEX "ical_conexiones_habitacion_id_idx" ON "ical_conexiones"("habitacion_id");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  CREATE INDEX "ical_conexiones_activo_idx" ON "ical_conexiones"("activo");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  CREATE INDEX "ical_bloqueos_habitacion_id_fecha_entrada_fecha_salida_idx" ON "ical_bloqueos"("habitacion_id", "fecha_entrada", "fecha_salida");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  CREATE UNIQUE INDEX "ical_bloqueos_habitacion_id_canal_uid_externo_key" ON "ical_bloqueos"("habitacion_id", "canal", "uid_externo");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ical_conexiones" ADD CONSTRAINT "ical_conexiones_habitacion_id_fkey"
    FOREIGN KEY ("habitacion_id") REFERENCES "habitaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ical_bloqueos" ADD CONSTRAINT "ical_bloqueos_habitacion_id_fkey"
    FOREIGN KEY ("habitacion_id") REFERENCES "habitaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Parte 5 — contexto_mercado
CREATE TABLE IF NOT EXISTS "contexto_mercado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID,
    "ciudad" VARCHAR(100),
    "tipo_evento" VARCHAR(50) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha_evento" DATE NOT NULL,
    "impacto_estimado" VARCHAR(20) NOT NULL,
    "fuente" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contexto_mercado_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX "contexto_mercado_empresa_id_fecha_evento_idx" ON "contexto_mercado"("empresa_id", "fecha_evento");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "contexto_mercado" ADD CONSTRAINT "contexto_mercado_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Parte 6 — CRM de plataforma (leads)
CREATE TABLE IF NOT EXISTS "plataforma_leads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre_contacto" VARCHAR(150) NOT NULL,
    "nombre_empresa" VARCHAR(150),
    "telefono" VARCHAR(20),
    "email" VARCHAR(150),
    "origen" VARCHAR(50),
    "estado" VARCHAR(30) NOT NULL DEFAULT 'nuevo',
    "empresa_id" UUID,
    "valor_estimado" DECIMAL(10,2),
    "notas" TEXT,
    "proxima_accion" TEXT,
    "proxima_accion_fecha" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plataforma_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "plataforma_lead_interacciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" UUID NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plataforma_lead_interacciones_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX "plataforma_leads_estado_idx" ON "plataforma_leads"("estado");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  CREATE INDEX "plataforma_lead_interacciones_lead_id_idx" ON "plataforma_lead_interacciones"("lead_id");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "plataforma_leads" ADD CONSTRAINT "plataforma_leads_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "plataforma_lead_interacciones" ADD CONSTRAINT "plataforma_lead_interacciones_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "plataforma_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
