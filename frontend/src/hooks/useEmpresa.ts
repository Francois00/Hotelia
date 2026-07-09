import { useMemo } from 'react'
import { getUser } from '../utils/auth'

export interface EmpresaBranding {
  nombreSistema: string
  logoUrl: string | null
  colorPrimario: string
  empresaId: string | null
  esSuperadminPlataforma: boolean
}

const DEFAULT: EmpresaBranding = {
  nombreSistema: 'Hotelia PMS',
  logoUrl: null,
  colorPrimario: '#1B3A6B',
  empresaId: null,
  esSuperadminPlataforma: false,
}

export function useEmpresa(): EmpresaBranding {
  return useMemo(() => {
    const user = getUser()
    if (!user) return DEFAULT
    return {
      nombreSistema: user.empresaNombreSistema || DEFAULT.nombreSistema,
      logoUrl: user.empresaLogoUrl || null,
      colorPrimario: user.empresaColorPrimario || DEFAULT.colorPrimario,
      empresaId: user.empresaId,
      esSuperadminPlataforma: user.esSuperadminPlataforma,
    }
  }, [])
}
