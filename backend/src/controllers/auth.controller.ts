import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as service from '../services/auth.service';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  // Validación mínima: no revelar requisitos de contraseña en mensajes de error
  password: z.string().min(1, 'Contraseña requerida'),
});

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await service.login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
