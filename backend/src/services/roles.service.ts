import { RolPersonal } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { hashPassword } from './auth.service';

export async function listarRoles() {
  return prisma.rol.findMany({
    include: { roles_permisos: { include: { permiso: true } } },
    orderBy: { nombre: 'asc' },
  }).then((roles) =>
    roles.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      alcance_global: r.alcance_global,
      permisos: r.roles_permisos.map((rp) => rp.permiso.codigo),
    })),
  );
}

export async function listarPermisos() {
  const permisos = await prisma.permiso.findMany({ orderBy: [{ modulo: 'asc' }, { nombre: 'asc' }] });
  const agrupados: Record<string, typeof permisos> = {};
  for (const p of permisos) {
    (agrupados[p.modulo] ??= []).push(p);
  }
  return agrupados;
}

export async function listarPersonal() {
  const personal = await prisma.personal.findMany({
    where: { activo: true },
    select: {
      id: true, nombre: true, apellido: true, email: true, activo: true,
      rol_nuevo: { select: { codigo: true, nombre: true } },
      usuario_locales: {
        where: { activo: true },
        select: {
          local_id: true, es_local_principal: true, puede_operar: true,
          local: { select: { nombre: true } },
          rol: { select: { codigo: true, nombre: true } },
        },
      },
    },
    orderBy: { nombre: 'asc' },
  });
  return personal;
}

// Mapeo best-effort rol nuevo → RolPersonal legado, mientras la columna `rol`
// siga siendo NOT NULL en `personal` (se elimina en la limpieza post-cutover).
const LEGADO_POR_DEFECTO: Record<string, RolPersonal> = {
  superadmin:    RolPersonal.ADMIN,
  dueno:         RolPersonal.ADMIN,
  gerente_local: RolPersonal.GERENTE,
  recepcionista: RolPersonal.RECEPCIONISTA,
  housekeeping:  RolPersonal.HOUSEKEEPING,
  mantenimiento: RolPersonal.MANTENIMIENTO,
  almacen:       RolPersonal.RECEPCIONISTA,
  contabilidad:  RolPersonal.GERENTE,
};

export interface CrearPersonalInput {
  nombre:    string;
  apellido:  string;
  email:     string;
  password:  string;
  local_id:  string;
  rol_codigo: string;
}

export async function crearPersonal(data: CrearPersonalInput) {
  const rol = await prisma.rol.findUnique({ where: { codigo: data.rol_codigo } });
  if (!rol) throw new AppError('ROL_NO_ENCONTRADO', 404, `Rol ${data.rol_codigo} no existe`);

  const local = await prisma.local.findUnique({ where: { id: data.local_id } });
  if (!local) throw new AppError('LOCAL_NO_ENCONTRADO', 404, 'Local no encontrado');

  const password_hash = await hashPassword(data.password);
  const rolLegado = LEGADO_POR_DEFECTO[data.rol_codigo] ?? RolPersonal.RECEPCIONISTA;

  try {
    return await prisma.$transaction(async (tx) => {
      const personal = await tx.personal.create({
        data: {
          nombre: data.nombre,
          apellido: data.apellido,
          email: data.email.toLowerCase(),
          password_hash,
          rol: rolLegado,
          rol_id: rol.id,
        },
      });

      if (!rol.alcance_global) {
        await tx.usuarioLocal.create({
          data: {
            personal_id: personal.id,
            local_id:    data.local_id,
            rol_id:      rol.id,
            es_local_principal: true,
          },
        });
      }

      return personal;
    });
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new AppError('EMAIL_DUPLICADO', 409, `Ya existe un usuario con el email ${data.email}`);
    }
    throw err;
  }
}

export interface AccesoLocalInput {
  local_id:       string;
  rol_codigo:     string;
  puede_operar?:  boolean;
}

export async function actualizarAccesos(personalId: string, accesos: AccesoLocalInput[]) {
  const personal = await prisma.personal.findUnique({ where: { id: personalId } });
  if (!personal) throw new AppError('PERSONAL_NO_ENCONTRADO', 404, 'Personal no encontrado');

  const roles = await prisma.rol.findMany({ where: { codigo: { in: accesos.map((a) => a.rol_codigo) } } });
  const rolPorCodigo = new Map(roles.map((r) => [r.codigo, r]));

  await prisma.$transaction(
    accesos.map((a) => {
      const rol = rolPorCodigo.get(a.rol_codigo);
      if (!rol) throw new AppError('ROL_NO_ENCONTRADO', 404, `Rol ${a.rol_codigo} no existe`);
      return prisma.usuarioLocal.upsert({
        where: { personal_id_local_id: { personal_id: personalId, local_id: a.local_id } },
        create: {
          personal_id: personalId,
          local_id:    a.local_id,
          rol_id:      rol.id,
          puede_operar: a.puede_operar ?? true,
        },
        update: {
          rol_id: rol.id,
          puede_operar: a.puede_operar ?? true,
        },
      });
    }),
  );

  return prisma.usuarioLocal.findMany({
    where: { personal_id: personalId, activo: true },
    include: { local: { select: { nombre: true } }, rol: { select: { codigo: true, nombre: true } } },
  });
}
