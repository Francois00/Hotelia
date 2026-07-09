import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message, ...err.details });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      code: 'VALIDACION_FALLIDA',
      message: 'Los datos enviados no son válidos',
      errors: err.errors.map((e) => ({ campo: e.path.join('.'), mensaje: e.message })),
    });
    return;
  }

  console.error('[error]', err);
  res.status(500).json({ code: 'ERROR_INTERNO', message: 'Error interno del servidor' });
}
