import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useRol } from '../hooks/useRol'

// Paleta ligada a los theme tokens (theme.css) — cambia sola con [data-theme].
const C = {
  bg: 'var(--bg-primary)', surface: 'var(--bg-secondary)', surface2: 'var(--bg-card)', surface3: 'var(--bg-tertiary)',
  border: 'var(--border-primary)', border2: 'var(--border-secondary)',
  text: 'var(--text-primary)', text2: 'var(--text-secondary)', text3: 'var(--text-tertiary)',
  green: 'var(--estado-disponible)', blue: 'var(--estado-ocupada)', yellow: 'var(--estado-limpieza)', red: 'var(--estado-mantenimiento)',
  gold: 'var(--brand-accent)',
}

interface LocalKpi {
  local_id: string
  local_nombre: string
  estado: string
  ocupacion_pct: number
  ingresos_hoy: number
  checkins_hoy: number
  checkouts_hoy: number
}

interface DashboardConsolidado {
  locales: LocalKpi[]
  consolidado: {
    total_ingresos_hoy: number
    ocupacion_media_pct: number
    total_reservas_activas_hoy: number
  }
}

const fmtMoneda = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ESTADO_OVERLAY: Record<string, { icon: string; label: string; color: string } | null> = {
  activo: null,
  pausado: { icon: '⏸️', label: 'Pausado', color: C.yellow },
  remodelacion: { icon: '🔧', label: 'En remodelación', color: C.blue },
  inactivo: { icon: '⚫', label: 'Inactivo', color: C.text3 },
}

const css = `
.dc-root{height:100%;background:${C.bg};color:${C.text};font-family:-apple-system,BlinkMacSystemFont,sans-serif;overflow-y:auto;}
.dc-root *{box-sizing:border-box;}
.dc-hd{padding:24px;border-bottom:1px solid ${C.border};background:${C.surface};}
.dc-title{font-size:20px;font-weight:800;color:${C.text};}
.dc-subtitle{font-size:13px;color:${C.text2};margin-top:4px;display:flex;align-items:center;gap:10px;}
.dc-badge{padding:3px 10px;border-radius:999px;background:rgba(77,150,255,0.12);color:${C.blue};font-size:11px;font-weight:700;}
.dc-body{padding:24px;}
.dc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:28px;}
.dc-kpi{background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:18px;}
.dc-kpi .icon{font-size:20px;margin-bottom:8px;}
.dc-kpi .k{font-size:11px;color:${C.text3};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;}
.dc-kpi .v{font-size:24px;font-weight:800;color:${C.text};}
.dc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px;}
.dc-card{position:relative;background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:14px;overflow:hidden;}
.dc-card-hd{display:flex;align-items:center;justify-content:space-between;}
.dc-card-name{font-size:15px;font-weight:800;color:${C.text};}
.dc-card-badge{font-size:11px;font-weight:700;color:${C.green};display:flex;align-items:center;gap:4px;}
.dc-bar-wrap{display:flex;align-items:center;gap:10px;}
.dc-bar-track{flex:1;height:8px;background:${C.surface2};border-radius:99px;overflow:hidden;}
.dc-bar-fill{height:100%;background:${C.blue};border-radius:99px;}
.dc-bar-pct{font-size:13px;font-weight:700;color:${C.text};min-width:38px;text-align:right;}
.dc-row{display:flex;justify-content:space-between;font-size:13px;color:${C.text2};}
.dc-row b{color:${C.text};font-weight:700;}
.dc-actions{display:flex;gap:8px;margin-top:4px;}
.dc-act-btn{flex:1;padding:8px;border-radius:8px;border:1px solid ${C.border2};background:transparent;color:${C.text2};font-size:12px;font-weight:600;cursor:pointer;}
.dc-act-btn:hover{color:${C.text};}
.dc-overlay{position:absolute;inset:0;background:var(--bg-overlay);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;font-size:14px;font-weight:700;backdrop-filter:blur(1px);}
.spinner-center{text-align:center;color:${C.text3};font-size:14px;padding:48px;}
.empty{text-align:center;color:${C.text3};font-size:14px;padding:48px;}
`

export default function DashboardConsolidadoPage() {
  const navigate = useNavigate()
  const { cambiarLocalActivo } = useRol()
  const [data, setData] = useState<DashboardConsolidado | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api.get<DashboardConsolidado>('/api/v1/locales/dashboard-consolidado')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setCargando(false))
  }, [])

  const irADashboardLocal = (localId: string) => {
    cambiarLocalActivo(localId)
    navigate('/dashboard')
  }

  const irAReservas = (localId: string) => {
    cambiarLocalActivo(localId)
    navigate('/reservas')
  }

  return (
    <div className="dc-root">
      <style>{css}</style>
      <div className="dc-hd">
        <div className="dc-title">Dashboard Consolidado</div>
        <div className="dc-subtitle">
          Todos los locales · {new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
          {data && <span className="dc-badge">{data.locales.length} locales</span>}
        </div>
      </div>

      <div className="dc-body">
        {cargando && <div className="spinner-center">Cargando...</div>}

        {!cargando && data && (
          <>
            <div className="dc-kpis">
              <div className="dc-kpi"><div className="icon">💰</div><div className="k">Ingresos hoy (todos)</div><div className="v">{fmtMoneda(data.consolidado.total_ingresos_hoy)}</div></div>
              <div className="dc-kpi"><div className="icon">🏨</div><div className="k">Ocupación media</div><div className="v">{data.consolidado.ocupacion_media_pct}%</div></div>
              <div className="dc-kpi"><div className="icon">🛎️</div><div className="k">Check-ins hoy</div><div className="v">{data.consolidado.total_reservas_activas_hoy}</div></div>
            </div>

            <div className="dc-grid">
              {data.locales.length === 0 && <div className="empty">No hay locales activos</div>}
              {data.locales.map(l => {
                const overlay = ESTADO_OVERLAY[l.estado]
                return (
                  <div key={l.local_id} className="dc-card">
                    {overlay && (
                      <div className="dc-overlay" style={{ color: overlay.color }}>
                        <span>{overlay.icon} {overlay.label}</span>
                      </div>
                    )}
                    <div className="dc-card-hd">
                      <span className="dc-card-name">🏨 {l.local_nombre}</span>
                      {!overlay && <span className="dc-card-badge">🟢 Activo</span>}
                    </div>
                    <div className="dc-bar-wrap">
                      <div className="dc-bar-track"><div className="dc-bar-fill" style={{ width: `${Math.min(100, l.ocupacion_pct)}%` }} /></div>
                      <span className="dc-bar-pct">{l.ocupacion_pct}%</span>
                    </div>
                    <div className="dc-row"><span>Ingresos hoy</span><b>{fmtMoneda(l.ingresos_hoy)}</b></div>
                    <div className="dc-row"><span>Check-ins / Check-outs</span><b>{l.checkins_hoy} / {l.checkouts_hoy}</b></div>
                    <div className="dc-actions">
                      <button className="dc-act-btn" onClick={() => irADashboardLocal(l.local_id)}>Ver dashboard</button>
                      <button className="dc-act-btn" onClick={() => irAReservas(l.local_id)}>Ver reservas</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!cargando && !data && <div className="empty">Error al cargar el dashboard consolidado</div>}
      </div>
    </div>
  )
}
