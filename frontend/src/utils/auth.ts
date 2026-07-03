export interface LocalGrant {
  local_id: string
  rol: string
}

export interface TokenPayload {
  sub: string
  email: string
  rolPrincipal: string
  esGlobal: boolean
  locales: LocalGrant[]
  iat?: number
  exp?: number
}

export function getUser(): TokenPayload | null {
  try {
    const token = localStorage.getItem('token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload as TokenPayload
  } catch {
    return null
  }
}

export interface LocalInfo {
  local_id: string
  local_nombre: string
  local_color: string
  rol: string
  es_local_principal: boolean
}

/** Datos de display (nombre, color) de los locales del usuario — no viaja en el JWT, se guarda aparte en el login. */
export function getLocalesInfo(): LocalInfo[] {
  try {
    return JSON.parse(localStorage.getItem('localesInfo') ?? '[]')
  } catch {
    return []
  }
}

/** Catálogo de permisos por rol, recibido en la respuesta de login y cacheado. */
export function getCatalogoPermisos(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem('catalogoPermisos') ?? '{}')
  } catch {
    return {}
  }
}

/** Local activo seleccionado — si el usuario solo tiene uno, se usa automáticamente. */
export function getActiveLocalId(): string | null {
  const stored = localStorage.getItem('activeLocalId')
  if (stored) return stored
  const user = getUser()
  if (user && !user.esGlobal && user.locales.length === 1) return user.locales[0].local_id
  return null
}

export function setActiveLocalId(localId: string | null): void {
  if (localId) localStorage.setItem('activeLocalId', localId)
  else localStorage.removeItem('activeLocalId')
}

/** Código del rol del usuario en el local activo (o rolPrincipal si es de alcance global). */
export function getRolActivo(): string | null {
  const user = getUser()
  if (!user) return null
  if (user.esGlobal) return user.rolPrincipal
  const localId = getActiveLocalId()
  const grant = user.locales.find(l => l.local_id === localId) ?? user.locales[0]
  return grant?.rol ?? null
}

export function tienePermiso(codigo: string): boolean {
  const user = getUser()
  if (!user) return false
  if (user.esGlobal) return true
  const rol = getRolActivo()
  if (!rol) return false
  return (getCatalogoPermisos()[rol] ?? []).includes(codigo)
}
