import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';
import { AppError } from '../lib/errors';

const CREDENCIALES_INVALIDAS = new AppError(
  'CREDENCIALES_INVALIDAS',
  401,
  'Email o contraseña incorrectos',
);

export async function login(email: string, password: string) {
  const personal = await prisma.personal.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      rol: true,
      activo: true,
      password_hash: true,
    },
  });

  // Mismo error para "no existe" y "contraseña incorrecta" — evita user enumeration
  if (!personal || !personal.activo) {
    throw CREDENCIALES_INVALIDAS;
  }

  const valid = await bcrypt.compare(password, personal.password_hash);
  if (!valid) {
    throw CREDENCIALES_INVALIDAS;
  }

  const token = signToken({ sub: personal.id, email: personal.email, rol: personal.rol });

  return {
    token,
    personal: {
      id: personal.id,
      nombre: personal.nombre,
      apellido: personal.apellido,
      email: personal.email,
      rol: personal.rol,
    },
  };
}

/** Genera un hash bcrypt — útil para crear usuarios desde scripts o seeds. */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}
