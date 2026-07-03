-- Backfill de local_id → 'Local Principal' para todas las tablas operativas de Fase 2.
-- Idempotente: solo toca filas con local_id IS NULL.
-- Run manually: docker exec -i hotel_db psql -U hotel_user -d hotel_db -f - < backend/prisma/backfill-local-id.sql

UPDATE tipos_habitacion SET local_id = (SELECT id FROM locales WHERE codigo = 'LOCAL-PRINCIPAL') WHERE local_id IS NULL;
UPDATE habitaciones      SET local_id = (SELECT id FROM locales WHERE codigo = 'LOCAL-PRINCIPAL') WHERE local_id IS NULL;
UPDATE reglas_temporada  SET local_id = (SELECT id FROM locales WHERE codigo = 'LOCAL-PRINCIPAL') WHERE local_id IS NULL;
UPDATE canal_sync_log    SET local_id = (SELECT id FROM locales WHERE codigo = 'LOCAL-PRINCIPAL') WHERE local_id IS NULL;
UPDATE concierge_mensajes SET local_id = (SELECT id FROM locales WHERE codigo = 'LOCAL-PRINCIPAL') WHERE local_id IS NULL;
UPDATE campanas_crm      SET local_id = (SELECT id FROM locales WHERE codigo = 'LOCAL-PRINCIPAL') WHERE local_id IS NULL;
UPDATE turnos            SET local_id = (SELECT id FROM locales WHERE codigo = 'LOCAL-PRINCIPAL') WHERE local_id IS NULL;
UPDATE audit_log         SET local_id = (SELECT id FROM locales WHERE codigo = 'LOCAL-PRINCIPAL') WHERE local_id IS NULL;
UPDATE almacen_articulos  SET local_id = (SELECT id FROM locales WHERE codigo = 'LOCAL-PRINCIPAL') WHERE local_id IS NULL;
UPDATE almacen_categorias SET local_id = (SELECT id FROM locales WHERE codigo = 'LOCAL-PRINCIPAL') WHERE local_id IS NULL;

-- contabilidad_config: una fila por local, con el correlativo actual de comprobantes precargado
-- para no romper la numeración SUNAT existente (fix del bug de Fase 5).
INSERT INTO contabilidad_config (id, local_id, correlativo_boleta, correlativo_factura)
SELECT
  gen_random_uuid(),
  l.id,
  COALESCE((SELECT MAX(correlativo::int) FROM comprobantes WHERE tipo = 'BOLETA'), 0),
  COALESCE((SELECT MAX(correlativo::int) FROM comprobantes WHERE tipo = 'FACTURA'), 0)
FROM locales l
WHERE l.codigo = 'LOCAL-PRINCIPAL'
ON CONFLICT (local_id) DO NOTHING;

-- Verificación: no debe quedar ninguna fila NULL en las tablas backfilleadas.
SELECT 'tipos_habitacion' t, COUNT(*) FROM tipos_habitacion WHERE local_id IS NULL
UNION ALL SELECT 'habitaciones', COUNT(*) FROM habitaciones WHERE local_id IS NULL
UNION ALL SELECT 'reglas_temporada', COUNT(*) FROM reglas_temporada WHERE local_id IS NULL
UNION ALL SELECT 'canal_sync_log', COUNT(*) FROM canal_sync_log WHERE local_id IS NULL
UNION ALL SELECT 'concierge_mensajes', COUNT(*) FROM concierge_mensajes WHERE local_id IS NULL
UNION ALL SELECT 'campanas_crm', COUNT(*) FROM campanas_crm WHERE local_id IS NULL
UNION ALL SELECT 'turnos', COUNT(*) FROM turnos WHERE local_id IS NULL
UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log WHERE local_id IS NULL
UNION ALL SELECT 'almacen_articulos', COUNT(*) FROM almacen_articulos WHERE local_id IS NULL
UNION ALL SELECT 'almacen_categorias', COUNT(*) FROM almacen_categorias WHERE local_id IS NULL
UNION ALL SELECT 'contabilidad_config', COUNT(*) FROM contabilidad_config;
