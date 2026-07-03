import { prisma } from './prisma';

// ─── Cache en memoria: rol.codigo → Set<permiso.codigo> ───────────────────────
// Evita un round-trip a BD en cada request autenticado. Se recarga al boot y cada
// REFRESH_MS — los cambios al catálogo roles_permisos tardan hasta ese intervalo
// en propagarse (los cambios a usuario_locales de un usuario ya están en su JWT,
// así que de todos modos solo aplican en el próximo login).

const REFRESH_MS = 5 * 60 * 1000;

let cache = new Map<string, Set<string>>();
let cargando: Promise<void> | null = null;

async function cargar(): Promise<void> {
  const filas = await prisma.rolPermiso.findMany({
    select: {
      rol: { select: { codigo: true } },
      permiso: { select: { codigo: true } },
    },
  });

  const nuevo = new Map<string, Set<string>>();
  for (const fila of filas) {
    const set = nuevo.get(fila.rol.codigo) ?? new Set<string>();
    set.add(fila.permiso.codigo);
    nuevo.set(fila.rol.codigo, set);
  }
  cache = nuevo;
}

export async function asegurarCacheCargado(): Promise<void> {
  if (cache.size > 0) return;
  if (!cargando) cargando = cargar();
  await cargando;
}

export function rolTienePermiso(rolCodigo: string, permisoCodigo: string): boolean {
  return cache.get(rolCodigo)?.has(permisoCodigo) ?? false;
}

/** Lista de códigos de permiso de un rol — usado para enviar el catálogo al frontend en el login. */
export function permisosDeRol(rolCodigo: string): string[] {
  return Array.from(cache.get(rolCodigo) ?? []);
}

export function iniciarRefrescoPeriodico(): void {
  cargar().catch((err) => console.error('[rolePermissionCache] error en carga inicial:', err));
  setInterval(() => {
    cargar().catch((err) => console.error('[rolePermissionCache] error en refresco:', err));
  }, REFRESH_MS).unref();
}
