import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// ─── Payload del token ────────────────────────────────────────────────────────

export interface AuthLocalGrant {
  local_id: string;
  rol: string; // roles.codigo
}

export interface AuthPayload {
  sub: string;           // personal.id (UUID)
  email: string;
  rolPrincipal: string;  // roles.codigo del rol "home" del usuario — solo para display
  esGlobal: boolean;     // true = superadmin/dueno, opera sobre cualquier local
  locales: AuthLocalGrant[];
  iat?: number;
  exp?: number;
}

// Extiende Express.Request para que req.user, req.localId y req.rawBody estén tipados
declare global {
  namespace Express {
    interface Request {
      user?:    AuthPayload;
      localId?: string | null;
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
