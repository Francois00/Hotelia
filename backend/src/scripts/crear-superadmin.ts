import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

// Script de un solo uso: crea (o rota la contraseña de) la cuenta superadmin de la
// plataforma SaaS. La contraseña generada se imprime UNA VEZ y se escribe también
// en el archivo indicado por --out (para que el operador la copie) — nunca se commitea.
//
// Uso: npx ts-node -r tsconfig-paths/register src/scripts/crear-superadmin.ts --out <ruta-archivo>

const EMAIL = 'superadmin@hotelia-platform.com';

function generarPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  const bytes = crypto.randomBytes(24);
  let pass = '';
  for (let i = 0; i < 24; i++) pass += chars[bytes[i] % chars.length];
  return pass;
}

async function main() {
  const outArgIndex = process.argv.indexOf('--out');
  const outPath = outArgIndex !== -1 ? process.argv[outArgIndex + 1] : null;

  const rol = await prisma.rol.findUnique({ where: { codigo: 'superadmin_plataforma' } });
  if (!rol) {
    throw new Error('El rol superadmin_plataforma no existe — aplica backend/prisma/seed-saas-empresas.sql primero');
  }

  const password = generarPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const personal = await prisma.personal.upsert({
    where: { email: EMAIL },
    update: { password_hash: passwordHash, es_superadmin_plataforma: true, rol_id: rol.id, activo: true },
    create: {
      nombre: 'Superadmin',
      apellido: 'Plataforma',
      email: EMAIL,
      password_hash: passwordHash,
      rol: 'ADMIN',
      rol_id: rol.id,
      es_superadmin_plataforma: true,
      empresa_id: null,
    },
  });

  console.log(`Superadmin listo: ${personal.email} (id: ${personal.id})`);
  console.log(`Password (mostrar UNA vez): ${password}`);

  if (outPath) {
    fs.writeFileSync(outPath, password, { encoding: 'utf-8' });
    console.log(`Password también escrita en: ${outPath} (bórrala luego de copiarla)`);
  }
}

main()
  .catch((err) => {
    console.error('Error creando superadmin:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
