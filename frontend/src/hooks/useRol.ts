import { useState, useEffect, useCallback } from 'react'
import {
  getUser, getCatalogoPermisos, getActiveLocalId, setActiveLocalId as persistActiveLocalId,
  getRolActivo, tienePermiso as tienePermisoUtil, getLocalesInfo,
} from '../utils/auth'

export function useRol() {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const sync = () => forceUpdate(n => n + 1)
    window.addEventListener('storage', sync)
    window.addEventListener('local-activo-cambiado', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('local-activo-cambiado', sync)
    }
  }, [])

  const cambiarLocalActivo = useCallback((localId: string | null) => {
    persistActiveLocalId(localId)
    window.dispatchEvent(new Event('local-activo-cambiado'))
  }, [])

  const user = getUser()
  const permisos = user ? (getCatalogoPermisos()[getRolActivo() ?? ''] ?? []) : []
  const localActivoId = getActiveLocalId()
  const localesInfo = getLocalesInfo()
  const localActivo = localesInfo.find(l => l.local_id === localActivoId) ?? localesInfo[0]

  return {
    nombre:            user?.email ?? '',
    email:             user?.email ?? '',
    esGlobal:          user?.esGlobal ?? false,
    rolPrincipal:      user?.rolPrincipal ?? null,
    rolActivo:         getRolActivo(),
    localActivoId,
    localActivoNombre: localActivo?.local_nombre ?? '',
    localActivoColor:  localActivo?.local_color ?? '#1B3A6B',
    locales:           localesInfo,
    localesDisponibles: localesInfo,
    cambiarLocalActivo,

    permisos,
    tienePermiso: tienePermisoUtil,
    puede: tienePermisoUtil,

    // Shortcuts de nivel — usados por la navegación y por rutas gateadas
    esNivelAlto: (user?.esGlobal ?? false) || localActivo?.rol === 'gerente_local',

    // Shortcuts de rol
    esSuperadmin:    user?.rolPrincipal === 'superadmin',
    esDueno:         user?.rolPrincipal === 'dueno',
    esGerenteLocal:  localActivo?.rol === 'gerente_local',
    esRecepcionista: localActivo?.rol === 'recepcionista',
    esHousekeeping:  localActivo?.rol === 'housekeeping',
    esMantenimiento: localActivo?.rol === 'mantenimiento',
    esAlmacen:       localActivo?.rol === 'almacen',
    esContabilidad:  localActivo?.rol === 'contabilidad',
  }
}
