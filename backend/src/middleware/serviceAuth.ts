import { Request, Response, NextFunction } from 'express';

export function serviceAuth(req: Request, res: Response, next: NextFunction): void {
  const token    = req.headers['x-service-token'] as string | undefined;
  const expected = process.env.BACKEND_SERVICE_TOKEN;

  if (!expected || !token || token !== expected) {
    res.status(401).json({ code: 'TOKEN_INVALIDO', message: 'X-Service-Token inválido' });
    return;
  }
  next();
}
