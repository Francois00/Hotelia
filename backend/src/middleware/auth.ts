import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RolPersonal } from '@prisma/client';

// ─── Payload del token ────────────────────────────────────────────────────────

export interface AuthPayload {
  sub: string;      // personal.id (UUID)
  email: string;
  rol: RolPersonal;
  iat?: number;
  exp?: number;
}

// Extiende Express.Request para que req.user y req.rawBody estén tipados
declare global {
  namespace Express {
    interface Request {
      user?:    AuthPayload;
      rawBody?: Buffer;
    }
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET no está configurado en las variables de entorno');
  return s;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Genera un token firmado con expiración de 8 h.
 * Usado por el endpoint POST /api/v1/auth/login.
 */
export function signToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '8h' });
}

/**
 * Middleware: verifica el header Authorization: Bearer <token>.
 * Inyecta req.user si el token es válido; devuelve 401 en caso contrario.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({
      code: 'TOKEN_REQUERIDO',
      message: 'Se requiere Authorization: Bearer <token>',
    });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, getSecret()) as AuthPayload;
    req.user = payload;
    next();
  } catch (err) {
    const expired = err instanceof jwt.TokenExpiredError;
    res.status(401).json({
      code: expired ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO',
      message: expired ? 'El token ha expirado, inicie sesión nuevamente' : 'Token inválido',
    });
  }
}

/**
 * Middleware factory: verifica que req.user tenga uno de los roles permitidos.
 * Debe usarse siempre después de `authenticate`.
 *
 * Uso: router.post('/ruta', authenticate, authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA), handler)
 */
export function authorize(...roles: RolPersonal[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Nunca debería llegar aquí si authenticate está antes, pero lo cubrimos
      res.status(401).json({ code: 'TOKEN_REQUERIDO', message: 'Autenticación requerida' });
      return;
    }

    if (roles.length > 0 && !roles.includes(req.user.rol)) {
      res.status(403).json({
        code: 'SIN_PERMISO',
        message: `Acceso restringido. Roles permitidos: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
}
