-- SaaS multi-empresa: roles y permisos de nivel plataforma.
-- Idempotente (ON CONFLICT DO NOTHING) — se puede correr más de una vez sin duplicar datos.
-- Run manually: docker exec -i hotel_db psql -U hotel_user -d hotel_db -f - < backend/prisma/seed-saas-empresas.sql

-- ─── Roles ────────────────────────────────────────────────────────────────────
-- alcance_global=true en ambos: el guard de empresa en middleware/permisos.ts acota
-- a admin_empresa a los locales de SU empresa; superadmin_plataforma (empresa_id NULL,
-- es_superadmin_plataforma=true en personal) queda sin acotar.

INSERT INTO roles (id, codigo, nombre, descripcion, alcance_global, es_sistema) VALUES
  (gen_random_uuid(), 'superadmin_plataforma', 'Superadmin Plataforma',    'Control total sobre todas las empresas del SaaS', true, true),
  (gen_random_uuid(), 'admin_empresa',         'Administrador de Empresa', 'Dueño de la cuenta, gestiona todos los locales de su empresa', true, true)
ON CONFLICT (codigo) DO NOTHING;

-- ─── Permisos de plataforma ─────────────────────────────────────────────────────

INSERT INTO permisos (id, codigo, nombre, modulo) VALUES
  (gen_random_uuid(), 'plataforma_ver_empresas',       'Ver todas las empresas',      'plataforma'),
  (gen_random_uuid(), 'plataforma_gestionar_empresas', 'Crear/suspender empresas',    'plataforma'),
  (gen_random_uuid(), 'plataforma_ver_pagos',          'Ver pagos de suscripción',    'plataforma'),
  (gen_random_uuid(), 'plataforma_registrar_pagos',    'Registrar pagos de empresas', 'plataforma')
ON CONFLICT (codigo) DO NOTHING;

-- ─── Permisos por rol ───────────────────────────────────────────────────────────
-- Nota: alcance_global=true ya hace bypass de estos chequeos en requirePermiso();
-- se llenan igual para que el catálogo de permisos (usado por el wizard de personal
-- y el frontend) no muestre estos roles con una lista vacía.

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p WHERE r.codigo = 'superadmin_plataforma'
ON CONFLICT DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r_dst.id, rp.permiso_id
FROM roles_permisos rp
JOIN roles r_src ON r_src.id = rp.rol_id AND r_src.codigo = 'dueno'
JOIN roles r_dst ON r_dst.codigo = 'admin_empresa'
ON CONFLICT DO NOTHING;
