import type { Request, Response, NextFunction } from 'express';

/**
 * Gate exclusivo del panel de plataforma SaaS — chequea directamente el flag
 * `esSuperadminPlataforma` del JWT, sin pasar por el catálogo de permisos por local
 * (este nivel está por encima de cualquier empresa/local).
 */
export function requireSuperadminPlataforma(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ code: 'TOKEN_REQUERIDO', message: 'Autenticación requerida' });
    return;
  }
  if (!req.user.esSuperadminPlataforma) {
    res.status(403).json({ code: 'SOLO_SUPERADMIN_PLATAFORMA', message: 'Acceso restringido al superadmin de la plataforma' });
    return;
  }
  next();
}

/**
 * Gate para paneles exclusivos de la cuenta EMPRESA (ej. "Ganancia" / pronóstico
 * de ocupación): solo admin_empresa/dueño (esGlobal con empresa asignada) — nunca
 * el superadmin de plataforma (sin empresa) ni cuentas de local individuales.
 */
export function requireNivelEmpresa(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ code: 'TOKEN_REQUERIDO', message: 'Autenticación requerida' });
    return;
  }
  if (!req.user.esGlobal || req.user.esSuperadminPlataforma || !req.user.empresaId) {
    res.status(403).json({ code: 'SOLO_NIVEL_EMPRESA', message: 'Acceso restringido a administradores de empresa' });
    return;
  }
  next();
}
