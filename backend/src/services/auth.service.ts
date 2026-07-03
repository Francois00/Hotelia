import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { asegurarCacheCargado, permisosDeRol } from '../lib/rolePermissionCache';

const CREDENCIALES_INVALIDAS = new AppError(
  'CREDENCIALES_INVALIDAS',
  401,
  'Email o contraseña incorrectos',
);

const SIN_ROL_ASIGNADO = new AppError(
  'SIN_ROL_ASIGNADO',
  403,
  'Este usuario no tiene un rol asignado. Contacte al administrador.',
);

export async function login(email: string, password: string) {
  const personal = await prisma.personal.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      activo: true,
      password_hash: true,
      rol_nuevo: { select: { codigo: true, alcance_global: true } },
      usuario_locales: {
        where: { activo: true },
        select: {
          local_id: true,
          es_local_principal: true,
          local: { select: { nombre: true, color_tema: true } },
          rol: { select: { codigo: true } },
        },
      },
    },
  });

  // Mismo error para "no existe" y "contraseña incorrecta" — evita user enumeration
  if (!personal || !personal.activo) {
    throw CREDENCIALES_INVALIDAS;
  }

  const valid = await bcrypt.compare(password, personal.password_hash);
  if (!valid) {
    throw CREDENCIALES_INVALIDAS;
  }

  if (!personal.rol_nuevo) {
    throw SIN_ROL_ASIGNADO;
  }

  const locales = personal.usuario_locales.map((ul) => ({
    local_id: ul.local_id,
    rol: ul.rol.codigo,
  }));

  const token = signToken({
    sub: personal.id,
    email: personal.email,
    rolPrincipal: personal.rol_nuevo.codigo,
    esGlobal: personal.rol_nuevo.alcance_global,
    locales,
  });

  await asegurarCacheCargado();
  const rolesInvolucrados = new Set([personal.rol_nuevo.codigo, ...locales.map((l) => l.rol)]);
  const catalogoPermisos: Record<string, string[]> = {};
  for (const codigo of rolesInvolucrados) {
    catalogoPermisos[codigo] = permisosDeRol(codigo);
  }

  return {
    token,
    personal: {
      id: personal.id,
      nombre: personal.nombre,
      apellido: personal.apellido,
      email: personal.email,
      rolPrincipal: personal.rol_nuevo.codigo,
      esGlobal: personal.rol_nuevo.alcance_global,
      locales: personal.usuario_locales.map((ul) => ({
        local_id: ul.local_id,
        local_nombre: ul.local.nombre,
        local_color: ul.local.color_tema,
        rol: ul.rol.codigo,
        es_local_principal: ul.es_local_principal,
      })),
    },
    catalogoPermisos,
  };
}

/** Genera un hash bcrypt — útil para crear usuarios desde scripts o seeds. */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}
