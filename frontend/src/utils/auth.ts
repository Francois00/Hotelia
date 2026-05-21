interface TokenPayload {
  sub: string
  email: string
  rol: string
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

export function getRole(): string {
  return getUser()?.rol ?? ''
}

export function isGerente(): boolean {
  const r = getRole()
  return r === 'GERENTE' || r === 'ADMIN'
}

export function canCheckin(): boolean {
  const r = getRole()
  return r === 'RECEPCIONISTA' || r === 'GERENTE' || r === 'ADMIN'
}
