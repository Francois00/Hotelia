-- Fase 2: flip a NOT NULL tras el backfill (habitaciones, turnos, almacen_articulos).

ALTER TABLE "habitaciones" ALTER COLUMN "local_id" SET NOT NULL;
ALTER TABLE "turnos" ALTER COLUMN "local_id" SET NOT NULL;
ALTER TABLE "almacen_articulos" ALTER COLUMN "local_id" SET NOT NULL;
