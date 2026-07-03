-- CreateEnum
CREATE TYPE "TipoAsientoContable" AS ENUM ('ingreso', 'egreso', 'ajuste', 'apertura', 'cierre');

-- AlterTable
ALTER TABLE "personal" ADD COLUMN     "rol_id" UUID;

-- CreateTable
CREATE TABLE "locales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "ruc" VARCHAR(11),
    "razon_social" VARCHAR(200),
    "direccion" TEXT,
    "ciudad" VARCHAR(100),
    "pais" VARCHAR(50) NOT NULL DEFAULT 'Perú',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'America/Lima',
    "moneda_default" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "telefono" VARCHAR(20),
    "email" VARCHAR(150),
    "color_tema" VARCHAR(7) NOT NULL DEFAULT '#1B3A6B',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'activo',
    "razon_pausa" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" TEXT,
    "alcance_global" BOOLEAN NOT NULL DEFAULT false,
    "es_sistema" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(60) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "modulo" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles_permisos" (
    "rol_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,

    CONSTRAINT "roles_permisos_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "usuario_locales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "personal_id" UUID NOT NULL,
    "local_id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "es_local_principal" BOOLEAN NOT NULL DEFAULT true,
    "puede_operar" BOOLEAN NOT NULL DEFAULT true,
    "puede_ver_info" BOOLEAN NOT NULL DEFAULT true,
    "permisos_extra" JSONB NOT NULL DEFAULT '[]',
    "permisos_removidos" JSONB NOT NULL DEFAULT '[]',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contabilidad_asientos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "local_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "numero_asiento" VARCHAR(20),
    "tipo" "TipoAsientoContable" NOT NULL,
    "concepto" TEXT NOT NULL,
    "debe" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cuenta_contable" VARCHAR(20),
    "referencia_id" UUID,
    "referencia_tipo" VARCHAR(30),
    "creado_por_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contabilidad_asientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contabilidad_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "local_id" UUID NOT NULL,
    "plan_cuentas" JSONB NOT NULL DEFAULT '{}',
    "periodo_fiscal" VARCHAR(7),
    "moneda_principal" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "sistema_contable" VARCHAR(50) NOT NULL DEFAULT 'manual',
    "serie_boleta" VARCHAR(10) NOT NULL DEFAULT 'B001',
    "correlativo_boleta" INTEGER NOT NULL DEFAULT 0,
    "serie_factura" VARCHAR(10) NOT NULL DEFAULT 'F001',
    "correlativo_factura" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contabilidad_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locales_codigo_key" ON "locales"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "roles_codigo_key" ON "roles"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE INDEX "permisos_modulo_idx" ON "permisos"("modulo");

-- CreateIndex
CREATE INDEX "usuario_locales_local_id_idx" ON "usuario_locales"("local_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_locales_personal_id_local_id_key" ON "usuario_locales"("personal_id", "local_id");

-- CreateIndex
CREATE INDEX "contabilidad_asientos_local_id_fecha_idx" ON "contabilidad_asientos"("local_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "contabilidad_config_local_id_key" ON "contabilidad_config"("local_id");

-- CreateIndex
CREATE INDEX "personal_rol_id_idx" ON "personal"("rol_id");

-- AddForeignKey
ALTER TABLE "personal" ADD CONSTRAINT "personal_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_locales" ADD CONSTRAINT "usuario_locales_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "personal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_locales" ADD CONSTRAINT "usuario_locales_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_locales" ADD CONSTRAINT "usuario_locales_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_asientos" ADD CONSTRAINT "contabilidad_asientos_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_config" ADD CONSTRAINT "contabilidad_config_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

