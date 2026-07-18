import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { getUser, estaImpersonando, restaurarSesionOriginalLocal } from '../utils/auth'

const ALTURA = 40

export default function BannerImpersonacion() {
  const navigate = useNavigate()
  const impersonando = estaImpersonando()

  useEffect(() => {
    document.body.style.paddingTop = impersonando ? `${ALTURA}px` : ''
    return () => { document.body.style.paddingTop = '' }
  }, [impersonando])

  if (!impersonando) return null

  const user = getUser()
  const empresaNombre = user?.empresaNombreSistema || 'esta empresa'

  const volver = async () => {
    let tokenFresco: string | null = null
    try {
      const { data } = await api.post('/api/v1/plataforma/salir-impersonacion')
      tokenFresco = data?.token ?? null
    } catch {
      // Sin conectividad o token vencido — igual restauramos desde el respaldo local
    }
    restaurarSesionOriginalLocal()
    if (tokenFresco) localStorage.setItem('token', tokenFresco)
    navigate('/plataforma/empresas')
    window.location.reload()
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: ALTURA, zIndex: 2000,
        background: '#eab308', color: '#1a1200', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 16, fontSize: 13, fontWeight: 700,
        fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', padding: '0 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <span>🔑 Estás viendo como: {empresaNombre} — Sesión de soporte</span>
      <button
        onClick={volver}
        style={{
          background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: 6, padding: '4px 10px',
          fontSize: 12, fontWeight: 700, color: '#1a1200', cursor: 'pointer',
        }}
      >
        ← Volver a mi panel de plataforma
      </button>
    </div>
  )
}
