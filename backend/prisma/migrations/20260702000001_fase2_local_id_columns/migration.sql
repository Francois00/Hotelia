-- Fase 2: local_id en tablas operativas (nullable por ahora — se backfillea y luego se
-- flippean a NOT NULL en habitaciones/turnos en una migración separada, 20260702000002).

-- AlterTable
ALTER TABLE "tipos_habitacion" ADD COLUMN "local_id" UUID;
CREATE INDEX "tipos_habitacion_local_id_idx" ON "tipos_habitacion"("local_id");
ALTER TABLE "tipos_habitacion" ADD CONSTRAINT "tipos_habitacion_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "habitaciones" ADD COLUMN "local_id" UUID;
CREATE INDEX "habitaciones_local_id_estado_idx" ON "habitaciones"("local_id", "estado");
ALTER TABLE "habitaciones" ADD CONSTRAINT "habitaciones_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "reglas_temporada" ADD COLUMN "local_id" UUID;
CREATE INDEX "reglas_temporada_local_id_idx" ON "reglas_temporada"("local_id");
ALTER TABLE "reglas_temporada" ADD CONSTRAINT "reglas_temporada_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "canal_sync_log" ADD COLUMN "local_id" UUID;
CREATE INDEX "canal_sync_log_local_id_idx" ON "canal_sync_log"("local_id");
ALTER TABLE "canal_sync_log" ADD CONSTRAINT "canal_sync_log_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "concierge_mensajes" ADD COLUMN "local_id" UUID;
CREATE INDEX "concierge_mensajes_local_id_idx" ON "concierge_mensajes"("local_id");
ALTER TABLE "concierge_mensajes" ADD CONSTRAINT "concierge_mensajes_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "campanas_crm" ADD COLUMN "local_id" UUID;
CREATE INDEX "campanas_crm_local_id_idx" ON "campanas_crm"("local_id");
ALTER TABLE "campanas_crm" ADD CONSTRAINT "campanas_crm_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "turnos" ADD COLUMN "local_id" UUID;
CREATE INDEX "turnos_local_id_fecha_idx" ON "turnos"("local_id", "fecha");
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN "local_id" UUID;
CREATE INDEX "audit_log_local_id_idx" ON "audit_log"("local_id");
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: almacen_* no están trackeadas por Prisma (creadas fuera de banda) — se agregan aquí igual
-- para que la migración completa de Fase 2 quede en un solo archivo aplicado atómicamente.
ALTER TABLE "almacen_articulos" ADD COLUMN "local_id" UUID;
CREATE INDEX "almacen_articulos_local_id_idx" ON "almacen_articulos"("local_id");
ALTER TABLE "almacen_articulos" ADD CONSTRAINT "almacen_articulos_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "almacen_categorias" ADD COLUMN "local_id" UUID;
CREATE INDEX "almacen_categorias_local_id_idx" ON "almacen_categorias"("local_id");
ALTER TABLE "almacen_categorias" ADD CONSTRAINT "almacen_categorias_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
