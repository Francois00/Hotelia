-- Extensions requeridas
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "RolPersonal" AS ENUM ('ADMIN', 'RECEPCIONISTA', 'HOUSEKEEPING', 'MANTENIMIENTO', 'GERENTE');

-- CreateEnum
CREATE TYPE "TipoHabitacion" AS ENUM ('SIMPLE', 'DOBLE', 'SUITE', 'FAMILIAR');

-- CreateEnum
CREATE TYPE "EstadoHabitacion" AS ENUM ('DISPONIBLE', 'OCUPADA', 'MANTENIMIENTO', 'LIMPIEZA');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('DNI', 'PASAPORTE', 'CE');

-- CreateEnum
CREATE TYPE "SegmentoHuesped" AS ENUM ('NORMAL', 'VIP', 'CORPORATIVO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('CONFIRMADA', 'CHECKIN_REALIZADO', 'CHECKOUT_REALIZADO', 'CANCELADA', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CanalReserva" AS ENUM ('DIRECTO', 'BOOKING_COM', 'EXPEDIA', 'WHATSAPP', 'TELEFONO');

-- CreateEnum
CREATE TYPE "TipoFolioItem" AS ENUM ('HABITACION', 'SERVICIO', 'MINIBAR', 'RESTAURANTE', 'LAVANDERIA', 'OTRO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'NIUBIZ', 'STRIPE');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'COMPLETADO', 'FALLIDO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('BOLETA', 'FACTURA');

-- CreateEnum
CREATE TYPE "CanalSync" AS ENUM ('BOOKING_COM', 'EXPEDIA');

-- CreateEnum
CREATE TYPE "TipoEventoSync" AS ENUM ('RESERVA_NUEVA', 'MODIFICACION', 'CANCELACION', 'DISPONIBILIDAD');

-- CreateEnum
CREATE TYPE "EstadoSync" AS ENUM ('PROCESADO', 'ERROR', 'PENDIENTE');

-- CreateEnum
CREATE TYPE "CanalReview" AS ENUM ('DIRECTO', 'BOOKING_COM', 'EXPEDIA', 'GOOGLE', 'TRIPADVISOR');

-- CreateEnum
CREATE TYPE "SentimientoReview" AS ENUM ('POSITIVO', 'NEUTRAL', 'NEGATIVO');

-- CreateEnum
CREATE TYPE "FuenteTarifa" AS ENUM ('MANUAL', 'AI', 'CHANNEL_MANAGER');

-- CreateEnum
CREATE TYPE "TipoCampana" AS ENUM ('EMAIL', 'WHATSAPP', 'AMBOS');

-- CreateEnum
CREATE TYPE "SegmentoCampana" AS ENUM ('NORMAL', 'VIP', 'CORPORATIVO', 'TODOS');

-- CreateEnum
CREATE TYPE "EstadoCampana" AS ENUM ('BORRADOR', 'PROGRAMADA', 'ENVIADA', 'PAUSADA');

-- CreateTable
CREATE TABLE "personal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol" "RolPersonal" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habitaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero" VARCHAR(10) NOT NULL,
    "tipo" "TipoHabitacion" NOT NULL,
    "piso" INTEGER NOT NULL,
    "capacidad" INTEGER NOT NULL DEFAULT 2,
    "tarifa_base" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoHabitacion" NOT NULL DEFAULT 'DISPONIBLE',
    "descripcion" TEXT,
    "amenidades" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "habitaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "huespedes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "telefono" VARCHAR(20),
    "tipo_documento" "TipoDocumento" NOT NULL,
    "numero_documento" VARCHAR(20) NOT NULL,
    "nacionalidad" VARCHAR(100),
    "fecha_nacimiento" DATE,
    "ltv" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "segmento" "SegmentoHuesped" NOT NULL DEFAULT 'NORMAL',
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "huespedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(20) NOT NULL,
    "huesped_id" UUID NOT NULL,
    "habitacion_id" UUID NOT NULL,
    "fecha_entrada" DATE NOT NULL,
    "fecha_salida" DATE NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'CONFIRMADA',
    "canal" "CanalReserva" NOT NULL DEFAULT 'DIRECTO',
    "tarifa_acordada" DECIMAL(10,2) NOT NULL,
    "adultos" INTEGER NOT NULL DEFAULT 1,
    "ninos" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "idempotency_key" VARCHAR(100),
    "personal_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reserva_id" UUID NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "tipo" "TipoFolioItem" NOT NULL DEFAULT 'HABITACION',
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reserva_id" UUID NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "metodo" "MetodoPago" NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "referencia_externa" VARCHAR(255),
    "numero_comprobante" VARCHAR(50),
    "tipo_comprobante" "TipoComprobante",
    "sunat_cdr" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canal_sync_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "canal" "CanalSync" NOT NULL,
    "tipo_evento" "TipoEventoSync" NOT NULL,
    "payload_entrada" JSONB NOT NULL,
    "payload_salida" JSONB,
    "reserva_id" UUID,
    "estado" "EstadoSync" NOT NULL DEFAULT 'PENDIENTE',
    "idempotency_key" VARCHAR(100) NOT NULL,
    "error_mensaje" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canal_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reserva_id" UUID NOT NULL,
    "huesped_id" UUID NOT NULL,
    "canal" "CanalReview" NOT NULL,
    "puntuacion" INTEGER NOT NULL,
    "texto" TEXT,
    "sentimiento" "SentimientoReview",
    "respondido" BOOLEAN NOT NULL DEFAULT false,
    "respuesta" TEXT,
    "fecha_review" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas_historial" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "habitacion_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "tarifa_base" DECIMAL(10,2) NOT NULL,
    "tarifa_aplicada" DECIMAL(10,2) NOT NULL,
    "ocupacion_pct" DECIMAL(5,2),
    "canal" "CanalReserva",
    "fuente" "FuenteTarifa" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarifas_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanas_crm" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(255) NOT NULL,
    "tipo" "TipoCampana" NOT NULL,
    "segmento_objetivo" "SegmentoCampana" NOT NULL DEFAULT 'TODOS',
    "estado" "EstadoCampana" NOT NULL DEFAULT 'BORRADOR',
    "fecha_programada" TIMESTAMPTZ(3),
    "fecha_enviada" TIMESTAMPTZ(3),
    "total_destinatarios" INTEGER NOT NULL DEFAULT 0,
    "total_enviados" INTEGER NOT NULL DEFAULT 0,
    "total_abiertos" INTEGER NOT NULL DEFAULT 0,
    "mensaje_whatsapp" TEXT,
    "asunto_email" VARCHAR(255),
    "cuerpo_email" TEXT,
    "personal_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campanas_crm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_email_key" ON "personal"("email");

-- CreateIndex
CREATE UNIQUE INDEX "habitaciones_numero_key" ON "habitaciones"("numero");

-- CreateIndex
CREATE INDEX "habitaciones_estado_idx" ON "habitaciones"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "huespedes_email_key" ON "huespedes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "huespedes_numero_documento_key" ON "huespedes"("numero_documento");

-- CreateIndex
CREATE INDEX "huespedes_numero_documento_idx" ON "huespedes"("numero_documento");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_codigo_key" ON "reservas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_idempotency_key_key" ON "reservas"("idempotency_key");

-- CreateIndex
CREATE INDEX "reservas_huesped_id_idx" ON "reservas"("huesped_id");

-- CreateIndex
CREATE INDEX "reservas_habitacion_id_idx" ON "reservas"("habitacion_id");

-- CreateIndex
CREATE INDEX "reservas_fecha_entrada_fecha_salida_idx" ON "reservas"("fecha_entrada", "fecha_salida");

-- CreateIndex
CREATE INDEX "reservas_estado_idx" ON "reservas"("estado");

-- CreateIndex
CREATE INDEX "folio_items_reserva_id_idx" ON "folio_items"("reserva_id");

-- CreateIndex
CREATE INDEX "pagos_reserva_id_idx" ON "pagos"("reserva_id");

-- CreateIndex
CREATE UNIQUE INDEX "canal_sync_log_idempotency_key_key" ON "canal_sync_log"("idempotency_key");

-- CreateIndex
CREATE INDEX "canal_sync_log_canal_estado_idx" ON "canal_sync_log"("canal", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_reserva_id_key" ON "reviews"("reserva_id");

-- CreateIndex
CREATE INDEX "reviews_huesped_id_idx" ON "reviews"("huesped_id");

-- CreateIndex
CREATE INDEX "tarifas_historial_habitacion_id_fecha_idx" ON "tarifas_historial"("habitacion_id", "fecha");

-- CreateIndex
CREATE INDEX "campanas_crm_estado_segmento_objetivo_idx" ON "campanas_crm"("estado", "segmento_objetivo");

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_huesped_id_fkey" FOREIGN KEY ("huesped_id") REFERENCES "huespedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_habitacion_id_fkey" FOREIGN KEY ("habitacion_id") REFERENCES "habitaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "personal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_items" ADD CONSTRAINT "folio_items_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canal_sync_log" ADD CONSTRAINT "canal_sync_log_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_huesped_id_fkey" FOREIGN KEY ("huesped_id") REFERENCES "huespedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifas_historial" ADD CONSTRAINT "tarifas_historial_habitacion_id_fkey" FOREIGN KEY ("habitacion_id") REFERENCES "habitaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanas_crm" ADD CONSTRAINT "campanas_crm_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "personal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Constraint anti-overbooking (requiere btree_gist)
ALTER TABLE reservas ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    habitacion_id WITH =,
    daterange(fecha_entrada, fecha_salida, '[)') WITH &&
  )
  WHERE (estado NOT IN ('CANCELADA', 'NO_SHOW'));

-- Índices trgm para búsqueda fuzzy de huéspedes (requiere pg_trgm)
CREATE INDEX idx_huespedes_nombre_trgm ON huespedes USING gin(nombre gin_trgm_ops);
CREATE INDEX idx_huespedes_apellido_trgm ON huespedes USING gin(apellido gin_trgm_ops);
