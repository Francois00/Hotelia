-- SaaS multi-empresa: tabla empresas (nivel superior sobre locales) + suscripciones.

-- CreateTable
CREATE TABLE "empresas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre_comercial" VARCHAR(150) NOT NULL,
    "razon_social" VARCHAR(200),
    "ruc" VARCHAR(11),
    "email_contacto" VARCHAR(150) NOT NULL,
    "telefono_contacto" VARCHAR(20),
    "logo_url" TEXT,
    "color_primario" VARCHAR(7) NOT NULL DEFAULT '#1B3A6B',
    "subdominio" VARCHAR(50) NOT NULL,
    "nombre_sistema" VARCHAR(100) NOT NULL DEFAULT 'Hotelia PMS',
    "plan" VARCHAR(20) NOT NULL DEFAULT 'basico',
    "max_locales" INTEGER NOT NULL DEFAULT 1,
    "max_usuarios" INTEGER NOT NULL DEFAULT 3,
    "max_habitaciones_por_local" INTEGER NOT NULL DEFAULT 30,
    "precio_mensual" DECIMAL(10,2) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'activa',
    "fecha_inicio_contrato" DATE NOT NULL DEFAULT CURRENT_DATE,
    "fecha_proximo_pago" DATE NOT NULL,
    "dias_gracia" INTEGER NOT NULL DEFAULT 5,
    "ultima_suspension_at" TIMESTAMPTZ(3),
    "motivo_suspension" TEXT,
    "notas_internas" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas_pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "fecha_pago" DATE,
    "metodo" VARCHAR(30),
    "referencia" VARCHAR(100),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "registrado_por_superadmin" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_subdominio_key" ON "empresas"("subdominio");

-- CreateIndex
CREATE INDEX "empresas_pagos_empresa_id_idx" ON "empresas_pagos"("empresa_id");

-- AddForeignKey
ALTER TABLE "empresas_pagos" ADD CONSTRAINT "empresas_pagos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: locales.empresa_id
ALTER TABLE "locales" ADD COLUMN "empresa_id" UUID;
CREATE INDEX "locales_empresa_id_idx" ON "locales"("empresa_id");
ALTER TABLE "locales" ADD CONSTRAINT "locales_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: personal.empresa_id + es_superadmin_plataforma
ALTER TABLE "personal" ADD COLUMN "empresa_id" UUID;
ALTER TABLE "personal" ADD COLUMN "es_superadmin_plataforma" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "personal_empresa_id_idx" ON "personal"("empresa_id");
ALTER TABLE "personal" ADD CONSTRAINT "personal_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Empresa por defecto: migra el local/personal existente bajo una única empresa "Hotel Hotelia"
INSERT INTO "empresas" (
    "nombre_comercial", "razon_social", "email_contacto",
    "subdominio", "nombre_sistema", "plan", "max_locales", "max_usuarios",
    "precio_mensual", "estado", "fecha_proximo_pago", "updated_at"
) VALUES (
    'Hotel Hotelia', 'Hotel Hotelia SAC', 'admin@hotelhotelia.com',
    'hotelia-demo', 'Hotelia PMS', 'premium', 999, 999,
    0, 'activa', CURRENT_DATE + INTERVAL '365 days', CURRENT_TIMESTAMP
) ON CONFLICT ("subdominio") DO NOTHING;

UPDATE "locales" SET "empresa_id" = (
    SELECT "id" FROM "empresas" WHERE "subdominio" = 'hotelia-demo' LIMIT 1
) WHERE "empresa_id" IS NULL;

UPDATE "personal" SET "empresa_id" = (
    SELECT "id" FROM "empresas" WHERE "subdominio" = 'hotelia-demo' LIMIT 1
) WHERE "empresa_id" IS NULL AND "es_superadmin_plataforma" IS NOT TRUE;
