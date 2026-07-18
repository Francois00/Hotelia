import { RolPersonal } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { hashPassword } from './auth.service';
import { signToken, AuthPayload } from '../middleware/auth';
import { asegurarCacheCargado, permisosDeRol } from '../lib/rolePermissionCache';

const PLANES_VALIDOS = ['basico', 'estandar', 'premium', 'empresa'];
const ESTADOS_VALIDOS = ['activa', 'suspendida', 'cancelada', 'prueba'];
const DIA_MS = 86_400_000;

function diasHastaVencer(fecha: Date): number {
  return Math.ceil((fecha.getTime() - Date.now()) / DIA_MS);
}

export async function listarEmpresas() {
  const empresas = await prisma.empresa.findMany({
    orderBy: { nombre_comercial: 'asc' },
    include: {
      locales: { select: { id: true } },
      personal: { where: { activo: true }, select: { id: true } },
      pagos: { orderBy: { created_at: 'desc' }, take: 1 },
    },
  });

  return empresas.map((e) => ({
    id: e.id,
    nombre_comercial: e.nombre_comercial,
    subdominio: e.subdominio,
    plan: e.plan,
    estado: e.estado,
    precio_mensual: e.precio_mensual,
    locales_count: e.locales.length,
    usuarios_count: e.personal.length,
    fecha_proximo_pago: e.fecha_proximo_pago,
    dias_hasta_vencer: diasHastaVencer(e.fecha_proximo_pago),
    ultimo_pago: e.pagos[0] ?? null,
  }));
}

export interface CrearEmpresaInput {
  nombre_comercial: string;
  razon_social?: string;
  ruc?: string;
  email_contacto: string;
  telefono_contacto?: string;
  subdominio: string;
  nombre_sistema?: string;
  plan: string;
  precio_mensual: number;
  max_locales: number;
  max_usuarios: number;
  max_habitaciones_por_local: number;
  admin_nombre: string;
  admin_email: string;
  admin_password: string;
}

export async function crearEmpresa(data: CrearEmpresaInput) {
  if (!PLANES_VALIDOS.includes(data.plan)) {
    throw new AppError('PLAN_INVALIDO', 400, `plan debe ser uno de: ${PLANES_VALIDOS.join(', ')}`);
  }

  const rolAdminEmpresa = await prisma.rol.findUnique({ where: { codigo: 'admin_empresa' } });
  if (!rolAdminEmpresa) {
    throw new AppError(
      'ROL_NO_ENCONTRADO',
      500,
      'El rol admin_empresa no existe — aplica backend/prisma/seed-saas-empresas.sql',
    );
  }

  const passwordHash = await hashPassword(data.admin_password);
  const [nombre, ...resto] = data.admin_nombre.trim().split(/\s+/);
  const apellido = resto.join(' ') || '-';

  const hoy = new Date();
  const proximoPago = new Date(hoy.getTime() + 30 * DIA_MS);
  const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const codigoLocal = `${data.subdominio.toUpperCase().replace(/[^A-Z0-9]/g, '')}-01`;

  try {
    return await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          nombre_comercial: data.nombre_comercial,
          razon_social: data.razon_social ?? null,
          ruc: data.ruc ?? null,
          email_contacto: data.email_contacto.toLowerCase(),
          telefono_contacto: data.telefono_contacto ?? null,
          subdominio: data.subdominio.toLowerCase(),
          nombre_sistema: data.nombre_sistema ?? 'Hotelia PMS',
          plan: data.plan,
          precio_mensual: data.precio_mensual,
          max_locales: data.max_locales,
          max_usuarios: data.max_usuarios,
          max_habitaciones_por_local: data.max_habitaciones_por_local,
          fecha_proximo_pago: proximoPago,
        },
      });

      const local = await tx.local.create({
        data: { empresa_id: empresa.id, codigo: codigoLocal, nombre: 'Local Principal' },
      });

      const admin = await tx.personal.create({
        data: {
          nombre: nombre || data.admin_nombre,
          apellido,
          email: data.admin_email.toLowerCase(),
          password_hash: passwordHash,
          rol: RolPersonal.ADMIN,
          rol_id: rolAdminEmpresa.id,
          empresa_id: empresa.id,
        },
      });

      await tx.empresaPago.create({
        data: { empresa_id: empresa.id, monto: data.precio_mensual, periodo, estado: 'pendiente' },
      });

      return { empresa, local, admin: { id: admin.id, email: admin.email } };
    });
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new AppError('DUPLICADO', 409, 'El subdominio o el email del administrador ya están en uso');
    }
    throw err;
  }
}

export interface ActualizarEmpresaInput {
  nombre_comercial?: string;
  razon_social?: string;
  ruc?: string;
  email_contacto?: string;
  telefono_contacto?: string;
  nombre_sistema?: string;
  logo_url?: string;
  color_primario?: string;
  plan?: string;
  precio_mensual?: number;
  max_locales?: number;
  max_usuarios?: number;
  max_habitaciones_por_local?: number;
}

export async function actualizarEmpresa(id: string, data: ActualizarEmpresaInput) {
  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (!empresa) throw new AppError('EMPRESA_NO_ENCONTRADA', 404, 'Empresa no encontrada');
  if (data.plan && !PLANES_VALIDOS.includes(data.plan)) {
    throw new AppError('PLAN_INVALIDO', 400, `plan debe ser uno de: ${PLANES_VALIDOS.join(', ')}`);
  }
  return prisma.empresa.update({ where: { id }, data });
}

export async function cambiarEstadoEmpresa(id: string, estado: string, motivo?: string) {
  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw new AppError('ESTADO_INVALIDO', 400, `estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`);
  }
  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (!empresa) throw new AppError('EMPRESA_NO_ENCONTRADA', 404, 'Empresa no encontrada');

  return prisma.empresa.update({
    where: { id },
    data: {
      estado,
      ultima_suspension_at: estado === 'suspendida' ? new Date() : empresa.ultima_suspension_at,
      motivo_suspension: estado === 'suspendida' ? (motivo ?? null) : null,
    },
  });
}

export async function listarPagos(empresaId: string) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  if (!empresa) throw new AppError('EMPRESA_NO_ENCONTRADA', 404, 'Empresa no encontrada');
  return prisma.empresaPago.findMany({ where: { empresa_id: empresaId }, orderBy: { created_at: 'desc' } });
}

export interface RegistrarPagoInput {
  monto: number;
  periodo: string;
  fecha_pago?: string;
  metodo?: string;
  referencia?: string;
}

export async function registrarPago(empresaId: string, data: RegistrarPagoInput) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  if (!empresa) throw new AppError('EMPRESA_NO_ENCONTRADA', 404, 'Empresa no encontrada');

  const fechaPago = data.fecha_pago ? new Date(data.fecha_pago) : new Date();
  const proximoPago = new Date(fechaPago.getTime() + 30 * DIA_MS);
  const reactivar = empresa.estado === 'suspendida';

  return prisma.$transaction(async (tx) => {
    const pago = await tx.empresaPago.create({
      data: {
        empresa_id: empresaId,
        monto: data.monto,
        periodo: data.periodo,
        fecha_pago: fechaPago,
        metodo: data.metodo ?? null,
        referencia: data.referencia ?? null,
        estado: 'pagado',
      },
    });

    await tx.empresa.update({
      where: { id: empresaId },
      data: {
        fecha_proximo_pago: proximoPago,
        ...(reactivar && { estado: 'activa', ultima_suspension_at: null, motivo_suspension: null }),
      },
    });

    return pago;
  });
}

const PERSONAL_PARA_TOKEN_SELECT = {
  id: true,
  email: true,
  empresa_id: true,
  rol_nuevo: { select: { codigo: true, alcance_global: true } },
  usuario_locales: {
    where: { activo: true } as const,
    select: {
      local_id: true,
      es_local_principal: true,
      local: { select: { nombre: true, color_tema: true } },
      rol: { select: { codigo: true } },
    },
  },
} as const;

/**
 * Genera un JWT temporal (2h) con la identidad de un usuario admin/dueño de la empresa
 * indicada, marcado con `impersonando: true`, para que el superadmin de plataforma
 * pueda entrar a dar soporte sin conocer la contraseña del cliente. Queda registrado
 * en audit_log para trazabilidad.
 */
export async function impersonarEmpresa(
  empresaId: string,
  superadmin: { id: string; email: string },
) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  if (!empresa) throw new AppError('EMPRESA_NO_ENCONTRADA', 404, 'Empresa no encontrada');

  let admin = await prisma.personal.findFirst({
    where: { empresa_id: empresaId, activo: true, rol_nuevo: { alcance_global: true } },
    orderBy: { created_at: 'asc' },
    select: PERSONAL_PARA_TOKEN_SELECT,
  });

  if (!admin) {
    // Sin admin_empresa/dueño: usar el primer usuario activo de la empresa (mayor antigüedad)
    admin = await prisma.personal.findFirst({
      where: { empresa_id: empresaId, activo: true },
      orderBy: { created_at: 'asc' },
      select: PERSONAL_PARA_TOKEN_SELECT,
    });
  }

  if (!admin || !admin.rol_nuevo) {
    throw new AppError(
      'SIN_USUARIOS_ACTIVOS',
      400,
      'La empresa no tiene usuarios activos con un rol asignado para impersonar',
    );
  }

  const locales = admin.usuario_locales.map((ul) => ({ local_id: ul.local_id, rol: ul.rol.codigo }));

  const token = signToken(
    {
      sub: admin.id,
      email: admin.email,
      rolPrincipal: admin.rol_nuevo.codigo,
      esGlobal: admin.rol_nuevo.alcance_global,
      locales,
      empresaId: admin.empresa_id,
      esSuperadminPlataforma: false,
      empresaNombreSistema: empresa.nombre_sistema,
      empresaLogoUrl: empresa.logo_url,
      empresaColorPrimario: empresa.color_primario,
      impersonando: true,
      superadminOriginalId: superadmin.id,
    },
    '2h',
  );

  await prisma.auditLog.create({
    data: {
      entidad: 'empresas',
      entidad_id: empresaId,
      accion: 'impersonacion',
      actor_id: superadmin.id,
      actor_email: superadmin.email,
      motivo: 'Acceso de soporte vía panel plataforma',
    },
  });

  await asegurarCacheCargado();
  const rolesInvolucrados = new Set([admin.rol_nuevo.codigo, ...locales.map((l) => l.rol)]);
  const catalogoPermisos: Record<string, string[]> = {};
  for (const codigo of rolesInvolucrados) {
    catalogoPermisos[codigo] = permisosDeRol(codigo);
  }

  return {
    token,
    empresa_nombre: empresa.nombre_comercial,
    expira_en: '2h',
    catalogoPermisos,
    localesInfo: admin.usuario_locales.map((ul) => ({
      local_id: ul.local_id,
      local_nombre: ul.local.nombre,
      local_color: ul.local.color_tema,
      rol: ul.rol.codigo,
      es_local_principal: ul.es_local_principal,
    })),
  };
}

/**
 * Restaura la sesión original del superadmin de plataforma a partir del
 * `superadminOriginalId` embebido en el JWT de impersonación actual.
 */
export async function salirImpersonacion(payload: AuthPayload) {
  if (!payload.impersonando || !payload.superadminOriginalId) {
    throw new AppError('NO_IMPERSONANDO', 400, 'La sesión actual no es una impersonación');
  }

  const superadmin = await prisma.personal.findUnique({
    where: { id: payload.superadminOriginalId },
    select: {
      id: true,
      email: true,
      activo: true,
      empresa_id: true,
      es_superadmin_plataforma: true,
      rol_nuevo: { select: { codigo: true, alcance_global: true } },
      empresa: { select: { nombre_sistema: true, logo_url: true, color_primario: true } },
    },
  });

  if (!superadmin || !superadmin.activo || !superadmin.rol_nuevo) {
    throw new AppError('SUPERADMIN_INVALIDO', 401, 'No se pudo restaurar la sesión original');
  }

  const token = signToken({
    sub: superadmin.id,
    email: superadmin.email,
    rolPrincipal: superadmin.rol_nuevo.codigo,
    esGlobal: superadmin.rol_nuevo.alcance_global,
    locales: [],
    empresaId: superadmin.empresa_id,
    esSuperadminPlataforma: superadmin.es_superadmin_plataforma,
    empresaNombreSistema: superadmin.empresa?.nombre_sistema ?? 'Hotelia PMS',
    empresaLogoUrl: superadmin.empresa?.logo_url ?? null,
    empresaColorPrimario: superadmin.empresa?.color_primario ?? '#1B3A6B',
  });

  return { token };
}

export async function dashboard() {
  const [totalEmpresas, activas, suspendidas, empresasActivas] = await Promise.all([
    prisma.empresa.count(),
    prisma.empresa.count({ where: { estado: 'activa' } }),
    prisma.empresa.count({ where: { estado: 'suspendida' } }),
    prisma.empresa.findMany({
      where: { estado: 'activa' },
      select: { id: true, nombre_comercial: true, precio_mensual: true, fecha_proximo_pago: true },
    }),
  ]);

  const mrr = empresasActivas.reduce((acc, e) => acc + Number(e.precio_mensual), 0);
  const ahora = Date.now();
  const en7dias = ahora + 7 * DIA_MS;

  const porVencer = empresasActivas.filter((e) => {
    const t = e.fecha_proximo_pago.getTime();
    return t >= ahora && t <= en7dias;
  });
  const atrasadas = empresasActivas.filter((e) => e.fecha_proximo_pago.getTime() < ahora);

  return {
    total_empresas: totalEmpresas,
    empresas_activas: activas,
    empresas_suspendidas: suspendidas,
    ingresos_mensuales_recurrentes: mrr,
    empresas_por_vencer: porVencer,
    empresas_atrasadas: atrasadas,
  };
}
