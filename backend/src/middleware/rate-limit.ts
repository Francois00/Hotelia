import type { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';

interface RateLimitOptions {
  max: number;        // intentos permitidos en la ventana
  windowSec: number;  // duración de la ventana en segundos
  keyPrefix: string;  // prefijo de la key en Redis
}

/**
 * Middleware factory de rate limiting basado en Redis INCR.
 * Fail-open: si Redis no está disponible, la petición pasa para no bloquear el servicio.
 */
export function rateLimitMiddleware(opts: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = `${opts.keyPrefix}:${ip}`;

    try {
      const count = await redis.incr(key);

      // Primera petición en la ventana: establecer TTL
      if (count === 1) {
        await redis.expire(key, opts.windowSec);
      }

      if (count > opts.max) {
        const ttl = await redis.ttl(key);
        res.setHeader('Retry-After', String(ttl));
        res.status(429).json({
          code: 'RATE_LIMIT_EXCEDIDO',
          message: `Demasiados intentos. Reintente en ${Math.ceil(ttl / 60)} minutos.`,
          retry_after_seconds: ttl,
        });
        return;
      }
    } catch {
      // Redis no disponible: fail-open para no bloquear el servicio
      console.warn('[rate-limit] Redis no disponible, omitiendo verificación');
    }

    next();
  };
}
