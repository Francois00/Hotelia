import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { asegurarCacheCargado, rolTienePermiso } from '../lib/rolePermissionCache';
import type { AuthLocalGrant, AuthPayload } from './auth';

// ─── Resolución del local activo ───────────────────────────────────────────────

/**
 * Un usuario de alcance global (esGlobal) solo bypassa el chequeo de permisos por
 * local dentro de SU PROPIA empresa. Solo el superadmin de plataforma (sin empresa
 * asignada) puede operar sobre locales de cualquier empresa. Sin este chequeo, el
 * admin_empresa de una empresa vería/operaría los locales de otras empresas del SaaS.
 */
async function localPerteneceAEmpresaDelUsuario(user: AuthPayload, localId: string): Promise<boolean> {
  if (user.esSuperadminPlataforma) return true;
  if (!user.empresaId) return false;
  const local = await prisma.local.findUnique({ where: { id: localId }, select: { empresa_id: true } });
  return local?.empresa_id === user.empresaId;
}

function extraerLocalId(req: Request): string | undefined {
  const header = req.header('X-Local-Id');
  if (header) return header;
  const query = req.query.local_id;
  if (typeof query === 'string') return query;
  const body = (req.body as { local_id?: string } | undefined)?.local_id;
  if (typeof body === 'string') return body;
  return undefined;
}

function buscarGrant(locales: AuthLocalGrant[], localId: string): AuthLocalGrant | undefined {
  return locales.find((l) => l.local_id === localId);
}

/**
 * Resuelve req.localId a partir del header X-Local-Id / query / body, validando que el
 * usuario tenga acceso a ese local (o sea de alcance global). No exige ningún permiso
 * específico — para endpoints de solo lectura abiertos a cualquier miembro del local.
 * Debe usarse siempre después de `authenticate`.
 */
export async function resolverLocal(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ code: 'TOKEN_REQUERIDO', message: 'Autenticación requerida' });
    return;
  }

  const localId = extraerLocalId(req);

  if (req.user.esGlobal) {
    if (localId && !(await localPerteneceAEmpresaDelUsuario(req.user, localId))) {
      res.status(403).json({ code: 'LOCAL_NO_AUTORIZADO', message: 'No tiene acceso a este local' });
      return;
    }
    if (!localId && !req.user.empresaId) {
      // Superadmin de plataforma sin empresa asignada: sin X-Local-Id no hay forma de
      // acotar la consulta a una empresa. Debe indicar el local o usar impersonación
      // (POST /plataforma/empresas/:id/impersonar) en vez de recibir datos sin acotar.
      res.status(400).json({
        code: 'LOCAL_REQUERIDO',
        message: 'Especifique un local (X-Local-Id) o ingrese como una empresa (impersonación) para acceder a estos datos',
      });
      return;
    }
    req.localId = localId ?? null;
    req.empresaId = req.user.empresaId;
    next();
    return;
  }

  if (!localId) {
    res.status(400).json({ code: 'LOCAL_REQUERIDO', message: 'Debe especificar el local (header X-Local-Id)' });
    return;
  }

  if (!buscarGrant(req.user.locales, localId)) {
    res.status(403).json({ code: 'LOCAL_NO_AUTORIZADO', message: 'No tiene acceso a este local' });
    return;
  }

  req.localId = localId;
  req.empresaId = req.user.empresaId;
  next();
}

/**
 * Middleware factory: exige que el usuario tenga, en el local resuelto (X-Local-Id /
 * query / body), al menos uno de los permisos indicados. Reemplaza a `authorize(...)`.
 * Los usuarios de alcance global (superadmin/dueno) siempre pasan.
 *
 * Uso: router.post('/ruta', authenticate, requirePermiso('reservas.gestionar'), handler)
 */
export function requirePermiso(...codigos: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ code: 'TOKEN_REQUERIDO', message: 'Autenticación requerida' });
      return;
    }

    const localId = extraerLocalId(req);

    if (req.user.esGlobal) {
      if (localId && !(await localPerteneceAEmpresaDelUsuario(req.user, localId))) {
        res.status(403).json({ code: 'LOCAL_NO_AUTORIZADO', message: 'No tiene acceso a este local' });
        return;
      }
      if (!localId && !req.user.empresaId) {
        res.status(400).json({
          code: 'LOCAL_REQUERIDO',
          message: 'Especifique un local (X-Local-Id) o ingrese como una empresa (impersonación) para acceder a estos datos',
        });
        return;
      }
      req.localId = localId ?? null;
      req.empresaId = req.user.empresaId;
      next();
      return;
    }

    if (!localId) {
      res.status(400).json({ code: 'LOCAL_REQUERIDO', message: 'Debe especificar el local (header X-Local-Id)' });
      return;
    }

    const grant = buscarGrant(req.user.locales, localId);
    if (!grant) {
      res.status(403).json({ code: 'LOCAL_NO_AUTORIZADO', message: 'No tiene acceso a este local' });
      return;
    }

    await asegurarCacheCargado();
    const autorizado = codigos.length === 0 || codigos.some((c) => rolTienePermiso(grant.rol, c));
    if (!autorizado) {
      res.status(403).json({
        code: 'SIN_PERMISO',
        message: `Acceso restringido. Permisos requeridos: ${codigos.join(', ')}`,
      });
      return;
    }

    req.localId = localId;
    req.empresaId = req.user.empresaId;
    next();
  };
}

/**
 * Check de permiso "inline" para usar dentro de un controller cuando la lógica de
 * autorización depende de datos del body (ej. "recepcionista no puede modificar precio").
 * Requiere que `resolverLocal` o `requirePermiso` ya hayan corrido antes en la cadena
 * (para que req.localId esté poblado).
 */
export async function tienePermisoActivo(req: Request, codigo: string): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.esGlobal) return true;
  if (!req.localId) return false;

  const grant = buscarGrant(req.user.locales, req.localId);
  if (!grant) return false;

  await asegurarCacheCargado();
  return rolTienePermiso(grant.rol, codigo);
}
