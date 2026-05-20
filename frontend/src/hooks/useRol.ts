import { useState, useEffect } from 'react'

type Rol = 'ADMIN' | 'GERENTE' | 'RECEPCIONISTA' | 'HOUSEKEEPING' | 'MANTENIMIENTO' | null

function parseRol(): Rol {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { rol?: Rol }
    return payload.rol ?? null
  } catch { return null }
}

export function useRol() {
  const [rol, setRol] = useState<Rol>(parseRol)

  useEffect(() => {
    const sync = () => setRol(parseRol())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const isAdmin = rol === 'ADMIN'
  const isGerente = rol === 'GERENTE' || isAdmin
  const isRecepcionista = rol === 'RECEPCIONISTA' || isGerente
  const isHousekeeping = rol === 'HOUSEKEEPING'
  const isMantenimiento = rol === 'MANTENIMIENTO'

  return {
    rol,
    isAdmin,
    isGerente,
    isRecepcionista,
    isHousekeeping,
    isMantenimiento,
    canCheckin: isRecepcionista,
    canModificarPrecio: isGerente,
  }
}
