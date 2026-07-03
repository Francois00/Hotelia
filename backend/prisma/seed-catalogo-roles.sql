-- Catálogo de roles, permisos y el local por defecto para la migración multi-local.
-- Idempotente (ON CONFLICT DO NOTHING) — se puede correr más de una vez sin duplicar datos.
-- Run manually: docker exec -i hotel_db psql -U hotel_user -d hotel_db -f - < backend/prisma/seed-catalogo-roles.sql

-- ─── Roles ────────────────────────────────────────────────────────────────────

INSERT INTO roles (id, codigo, nombre, descripcion, alcance_global, es_sistema) VALUES
  (gen_random_uuid(), 'superadmin',    'Superadministrador',  'Acceso total a todos los locales y configuración', true,  true),
  (gen_random_uuid(), 'dueno',         'Dueño / Propietario', 'Ve todos los locales, contabilidad y reportes consolidados', true,  true),
  (gen_random_uuid(), 'gerente_local', 'Gerente de Local',    'Control total de su local asignado', false, true),
  (gen_random_uuid(), 'recepcionista', 'Recepcionista',       'Check-in, checkout, reservas y turno de caja', false, true),
  (gen_random_uuid(), 'housekeeping',  'Housekeeping',        'Plan del día y estados de habitaciones', false, true),
  (gen_random_uuid(), 'mantenimiento', 'Mantenimiento',       'Órdenes de mantenimiento de su local', false, true),
  (gen_random_uuid(), 'almacen',       'Encargado Almacén',   'Inventario, entradas y salidas de stock', false, true),
  (gen_random_uuid(), 'contabilidad',  'Contador',            'Módulo de contabilidad de su local', false, true)
ON CONFLICT (codigo) DO NOTHING;

-- ─── Permisos ─────────────────────────────────────────────────────────────────
-- Derivados de los call sites reales de authorize() en backend/src/routes/*.ts (ver plan de migración).
-- Los endpoints de solo lectura no requieren permiso explícito hoy (solo `authenticate` + membresía de local).

INSERT INTO permisos (id, codigo, nombre, modulo) VALUES
  (gen_random_uuid(), 'alertas.gestionar',            'Crear/configurar alertas de mantenimiento', 'alertas'),
  (gen_random_uuid(), 'alertas.resolver',              'Resolver alertas de mantenimiento',          'alertas'),
  (gen_random_uuid(), 'almacen.administrar',           'CRUD de artículos y cierre de inventario',   'almacen'),
  (gen_random_uuid(), 'almacen.movimiento.registrar',  'Registrar entrada/salida de stock',          'almacen'),
  (gen_random_uuid(), 'crm.campanas.gestionar',        'Crear y enviar campañas CRM',                'crm'),
  (gen_random_uuid(), 'channel_manager.gestionar',     'Configurar canales externos (OTAs)',         'channel_manager'),
  (gen_random_uuid(), 'checkin.ejecutar',              'Ejecutar check-in manual',                   'operaciones'),
  (gen_random_uuid(), 'huespedes.gestionar',           'Crear/actualizar huéspedes',                 'huespedes'),
  (gen_random_uuid(), 'huespedes.eliminar',            'Eliminar huéspedes',                         'huespedes'),
  (gen_random_uuid(), 'comprobantes.emitir',           'Emitir boletas/facturas SUNAT',              'comprobantes'),
  (gen_random_uuid(), 'comprobantes.ver',              'Listar comprobantes emitidos',                'comprobantes'),
  (gen_random_uuid(), 'folio.gestionar',               'Agregar/anular ítems de folio',              'folio'),
  (gen_random_uuid(), 'habitaciones.administrar',      'CRUD de habitaciones, fotos y tarifas',      'habitaciones'),
  (gen_random_uuid(), 'habitaciones.estado.cambiar',   'Cambiar estado de una habitación',           'habitaciones'),
  (gen_random_uuid(), 'habitaciones.tipos.gestionar',  'CRUD de tipos de habitación',                'habitaciones'),
  (gen_random_uuid(), 'housekeeping.gestionar',        'Plan del día y checklist de limpieza',       'housekeeping'),
  (gen_random_uuid(), 'mantenimiento.gestionar',       'Órdenes de mantenimiento',                    'mantenimiento'),
  (gen_random_uuid(), 'pagos.procesar',                'Iniciar/confirmar pagos',                    'pagos'),
  (gen_random_uuid(), 'pagos.reembolsar',              'Reembolsar pagos',                           'pagos'),
  (gen_random_uuid(), 'tarifas.reglas.gestionar',      'CRUD de reglas de temporada/tarifa',         'tarifas'),
  (gen_random_uuid(), 'reportes.ver',                  'Ver y exportar reportes',                    'reportes'),
  (gen_random_uuid(), 'reservas.gestionar',            'Crear/modificar/cambiar estado de reservas', 'reservas'),
  (gen_random_uuid(), 'reservas.anular',               'Cancelar reservas y ver auditoría',          'reservas'),
  (gen_random_uuid(), 'reservas.modificar_precio',     'Modificar tarifa_acordada de una reserva',   'reservas'),
  (gen_random_uuid(), 'turnos.ver_todos',              'Ver turnos de todo el personal (no solo los propios)', 'caja'),
  (gen_random_uuid(), 'revenue.ver',                   'Ver módulo de revenue management',           'revenue'),
  (gen_random_uuid(), 'solicitudes.gestionar',         'Gestionar solicitudes de huéspedes',         'solicitudes'),
  (gen_random_uuid(), 'solicitudes.atender',           'Atender solicitudes (housekeeping)',         'solicitudes'),
  (gen_random_uuid(), 'turnos.gestionar',              'Abrir/cerrar turno de caja',                 'caja'),
  (gen_random_uuid(), 'locales.gestionar',             'Crear/editar/pausar locales',                'locales'),
  (gen_random_uuid(), 'personal.gestionar',            'Gestionar accesos de personal',              'personal'),
  (gen_random_uuid(), 'contabilidad.ver',              'Ver módulo de contabilidad',                 'contabilidad'),
  (gen_random_uuid(), 'contabilidad.gestionar',        'Crear asientos manuales',                    'contabilidad'),
  (gen_random_uuid(), 'contabilidad.exportar',         'Exportar libros contables/PLE',              'contabilidad'),
  (gen_random_uuid(), 'dashboard.consolidado.ver',     'Ver dashboard consolidado de todos los locales', 'dashboard')
ON CONFLICT (codigo) DO NOTHING;

-- ─── Permisos por rol ─────────────────────────────────────────────────────────
-- Replica el comportamiento actual de authorize() para que el día 1 no cambie nada.

-- superadmin y dueño: todos los permisos (además de ser alcance_global)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p WHERE r.codigo IN ('superadmin', 'dueno')
ON CONFLICT DO NOTHING;

-- gerente_local: todo excepto locales.gestionar, contabilidad.* y dashboard.consolidado.ver
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.codigo = 'gerente_local'
  AND p.codigo NOT IN ('locales.gestionar', 'contabilidad.ver', 'contabilidad.gestionar', 'contabilidad.exportar', 'dashboard.consolidado.ver')
ON CONFLICT DO NOTHING;

-- gerente_local también ve todos los turnos y puede modificar precio (ya cubierto por el NOT IN de arriba,
-- salvo que ambos códigos nuevos también apliquen — se listan explícitos por claridad)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.codigo = 'gerente_local' AND p.codigo IN ('reservas.modificar_precio', 'turnos.ver_todos')
ON CONFLICT DO NOTHING;

-- recepcionista
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.codigo = 'recepcionista'
  AND p.codigo IN (
    'checkin.ejecutar', 'huespedes.gestionar', 'comprobantes.emitir', 'folio.gestionar',
    'mantenimiento.gestionar', 'pagos.procesar', 'reservas.gestionar', 'solicitudes.gestionar',
    'solicitudes.atender', 'turnos.gestionar', 'almacen.movimiento.registrar'
  )
ON CONFLICT DO NOTHING;

-- housekeeping
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.codigo = 'housekeeping'
  AND p.codigo IN ('habitaciones.estado.cambiar', 'housekeeping.gestionar', 'solicitudes.atender')
ON CONFLICT DO NOTHING;

-- mantenimiento
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.codigo = 'mantenimiento'
  AND p.codigo IN ('habitaciones.estado.cambiar', 'mantenimiento.gestionar', 'alertas.resolver')
ON CONFLICT DO NOTHING;

-- almacen
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.codigo = 'almacen'
  AND p.codigo IN ('almacen.administrar', 'almacen.movimiento.registrar')
ON CONFLICT DO NOTHING;

-- contabilidad
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.codigo = 'contabilidad'
  AND p.codigo IN ('contabilidad.ver', 'contabilidad.gestionar', 'contabilidad.exportar', 'reportes.ver', 'comprobantes.ver')
ON CONFLICT DO NOTHING;

-- ─── Local por defecto ────────────────────────────────────────────────────────

INSERT INTO locales (id, codigo, nombre, ciudad, estado, updated_at)
VALUES (gen_random_uuid(), 'LOCAL-PRINCIPAL', 'Local Principal', 'Arequipa', 'activo', now())
ON CONFLICT (codigo) DO NOTHING;

-- ─── Backfill: personal.rol_id según el rol legado ───────────────────────────

UPDATE personal p SET rol_id = r.id
FROM roles r
WHERE p.rol_id IS NULL AND r.codigo = CASE p.rol
  WHEN 'ADMIN'         THEN 'superadmin'
  WHEN 'GERENTE'       THEN 'gerente_local'
  WHEN 'RECEPCIONISTA' THEN 'recepcionista'
  WHEN 'HOUSEKEEPING'  THEN 'housekeeping'
  WHEN 'MANTENIMIENTO' THEN 'mantenimiento'
END;

-- ─── Backfill: usuario_locales para roles con alcance local ──────────────────
-- (ADMIN/superadmin no necesita fila aquí: es alcance_global)

INSERT INTO usuario_locales (id, personal_id, local_id, rol_id, es_local_principal)
SELECT gen_random_uuid(), p.id, l.id, p.rol_id, true
FROM personal p
CROSS JOIN (SELECT id FROM locales WHERE codigo = 'LOCAL-PRINCIPAL') l
JOIN roles r ON r.id = p.rol_id
WHERE r.alcance_global = false
ON CONFLICT (personal_id, local_id) DO NOTHING;

-- ─── Verificación ─────────────────────────────────────────────────────────────

SELECT 'locales' AS t, COUNT(*) FROM locales
UNION ALL SELECT 'roles', COUNT(*) FROM roles
UNION ALL SELECT 'permisos', COUNT(*) FROM permisos
UNION ALL SELECT 'roles_permisos', COUNT(*) FROM roles_permisos
UNION ALL SELECT 'usuario_locales', COUNT(*) FROM usuario_locales
UNION ALL SELECT 'personal_sin_rol_id', COUNT(*) FROM personal WHERE rol_id IS NULL;
