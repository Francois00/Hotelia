import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Turno { tipo: string; hora_inicio: string; hora_fin: string; recaudado_total: number }
interface Habitacion { id: string; numero: string; piso: number; estado: string; tipo_nombre?: string; huesped_nombre?: string; hora_salida?: string }
interface Reserva { id: string; huesped_nombre: string; habitacion_numero: string; hora_salida?: string; saldo_pendiente?: number; estado: string }
interface Solicitud { id: string; tipo: string; descripcion: string; habitacion_numero?: string; huesped_nombre?: string; created_at: string }
interface ReporteMensual { ingresos_totales: number; num_reservas: number; ocupacion_pct: number; adr: number; revpar: number; comparativa_mes_anterior?: { ingresos_delta: number; ocupacion_delta: number } }

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#090C11', surface: '#0E1117', surface2: '#12161E', surface3: '#1A1F2B',
  border: 'rgba(255,255,255,0.06)', border2: 'rgba(255,255,255,0.1)',
  gold: '#D4A853', green: '#22C55E', blue: '#3B82F6', red: '#EF4444', yellow: '#EAB308',
  text: '#F1F5F9', text2: '#94A3B8', text3: '#64748B',
}

const css = `
.dash-root { background: ${C.bg}; color: ${C.text}; min-height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif; }
.dash-root * { box-sizing: border-box; }
.card { background: ${C.surface2}; border: 1px solid ${C.border}; border-radius: 12px; overflow: hidden; }
.card-hd { display: flex; align-items: flex-start; justify-content: space-between; padding: 16px 16px 12px; gap: 12px; }
.card-title { font-size: 13px; font-weight: 600; color: ${C.text}; }
.card-subtitle { font-size: 11px; color: ${C.text3}; margin-top: 2px; }
.card-bd { padding: 12px 16px 16px; }
.kpi-zone { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }
.kpi-card { background: ${C.surface2}; border: 1px solid ${C.border}; border-radius: 12px; padding: 14px 16px 12px; }
.kpi-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.kpi-title { font-size: 11px; font-weight: 500; color: ${C.text3}; text-transform: uppercase; letter-spacing: 0.04em; }
.kpi-icon { color: ${C.text3}; }
.kpi-value { font-size: 28px; font-weight: 700; line-height: 1; margin-bottom: 8px; font-variant-numeric: tabular-nums; }
.kpi-sub { font-size: 11px; color: ${C.text3}; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.kpi-delta.up { color: ${C.green}; font-weight: 600; }
.kpi-delta.down { color: ${C.red}; font-weight: 600; }
.kpi-turno-bar { height: 4px; background: ${C.surface3}; border-radius: 2px; margin: 8px 0 6px; overflow: hidden; }
.kpi-turno-bar-fill { height: 100%; background: ${C.gold}; border-radius: 2px; transition: width 0.6s ease; }
.kpi-turno-times { display: flex; justify-content: space-between; font-size: 10px; color: ${C.text3}; }
.kpi-gauge-wrap { display: flex; justify-content: center; margin: 4px 0 8px; }
.gauge-svg circle { transform-origin: 50% 50%; }
.zone-two { display: grid; grid-template-columns: 1fr 280px; gap: 12px; margin-bottom: 16px; }
.zone-three { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 12px; }
.floor { margin-bottom: 12px; }
.floor:last-child { margin-bottom: 0; }
.floor-label { font-size: 11px; font-weight: 600; color: ${C.text3}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 6px; }
.room-tile { border-radius: 8px; padding: 6px 8px; cursor: pointer; transition: opacity 0.15s; border: 1px solid transparent; }
.room-tile:hover { opacity: 0.8; }
.room-tile.disponible { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.2); }
.room-tile.ocupada { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.25); }
.room-tile.limpieza { background: rgba(234,179,8,0.12); border-color: rgba(234,179,8,0.2); }
.room-tile.mantenimiento { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.2); }
.room-num { font-size: 12px; font-weight: 700; color: ${C.text}; }
.room-meta { font-size: 9px; color: ${C.text3}; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.room-legend { display: flex; gap: 12px; flex-wrap: wrap; }
.room-legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: ${C.text3}; }
.room-legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.timeline { padding: 4px 0; }
.tl-item { display: flex; gap: 10px; margin-bottom: 12px; }
.tl-line { display: flex; flex-direction: column; align-items: center; width: 16px; flex-shrink: 0; }
.tl-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }
.tl-connector { width: 1px; background: ${C.border2}; flex: 1; margin-top: 4px; min-height: 16px; }
.tl-content { flex: 1; min-width: 0; }
.tl-time { font-size: 10px; color: ${C.text3}; margin-bottom: 1px; }
.tl-desc { font-size: 12px; color: ${C.text}; font-weight: 500; }
.tl-tags { display: flex; gap: 4px; margin-top: 3px; flex-wrap: wrap; }
.tl-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: ${C.surface3}; color: ${C.text3}; }
.tl-tag-guest { background: rgba(59,130,246,0.15); color: ${C.blue}; }
.co-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid ${C.border}; }
.co-row:last-child { border-bottom: none; }
.co-avatar { width: 30px; height: 30px; border-radius: 50%; background: ${C.surface3}; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: ${C.text2}; flex-shrink: 0; }
.co-info { flex: 1; min-width: 0; }
.co-name { font-size: 12px; font-weight: 600; color: ${C.text}; }
.co-meta { font-size: 10px; color: ${C.text3}; display: flex; gap: 6px; margin-top: 1px; }
.co-room { color: ${C.blue}; }
.co-saldo { font-size: 11px; font-weight: 700; flex-shrink: 0; }
.co-saldo.ok { color: ${C.green}; }
.co-saldo.pend { color: ${C.red}; }
.clean-row { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid ${C.border}; }
.clean-row:last-child { border-bottom: none; }
.clean-room-num { font-size: 13px; font-weight: 700; color: ${C.yellow}; width: 34px; flex-shrink: 0; }
.clean-person { font-size: 11px; color: ${C.text}; margin-bottom: 4px; }
.clean-progress { height: 3px; background: ${C.surface3}; border-radius: 2px; overflow: hidden; }
.clean-progress-fill { height: 100%; border-radius: 2px; transition: width 0.4s; }
.clean-timer { font-size: 11px; font-weight: 700; color: ${C.text2}; flex-shrink: 0; min-width: 36px; text-align: right; font-variant-numeric: tabular-nums; }
.clean-timer-warn { color: ${C.red}; }
.chart-legend { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
.chart-legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: ${C.text3}; }
.chart-legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.badge-sm { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; }
.badge-sm.yellow { background: rgba(234,179,8,0.15); color: ${C.yellow}; }
.badge-sm.green { background: rgba(34,197,94,0.15); color: ${C.green}; }
.spinner-center { display: flex; align-items: center; justify-content: center; height: 100%; min-height: 300px; color: ${C.text3}; }
.error-center { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px; gap: 12px; color: ${C.text3}; }
.retry-btn { padding: 8px 16px; background: ${C.surface3}; border: 1px solid ${C.border2}; border-radius: 8px; color: ${C.text}; cursor: pointer; font-size: 13px; }
.retry-btn:hover { background: ${C.surface}; }
@media (max-width: 1400px) { .kpi-zone { grid-template-columns: repeat(3, 1fr); } .zone-two { grid-template-columns: 1fr; } .zone-three { grid-template-columns: 1fr 1fr; } }
@media (max-width: 900px) { .kpi-zone { grid-template-columns: repeat(2, 1fr); } .zone-three { grid-template-columns: 1fr; } }
`

// ─── OccupancyGauge ───────────────────────────────────────────────────────────
function OccupancyGauge({ value }: { value: number }) {
  const r = 38
  const circumference = 2 * Math.PI * r
  const offset = circumference - (value / 100) * circumference
  return (
    <div className="kpi-gauge-wrap">
      <svg width="88" height="88" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke={C.surface3} strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={C.gold} strokeWidth="7"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)' }} />
        <text x="50" y="48" textAnchor="middle" dominantBaseline="central"
          fill={C.gold} fontSize="20" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">
          {value}%
        </text>
        <text x="50" y="64" textAnchor="middle" fill={C.text3} fontSize="9" fontFamily="Plus Jakarta Sans, sans-serif">
          ocupación
        </text>
      </svg>
    </div>
  )
}

// ─── RevenueChart ─────────────────────────────────────────────────────────────
function RevenueChart({ data }: { data: Array<{ dia: string; valor: number }> }) {
  const [hover, setHover] = useState<number | null>(null)
  const maxVal = useMemo(() => Math.max(...data.map(d => d.valor), 1), [data])
  const W = 100, H = 140

  return (
    <div className="card">
      <div className="card-hd">
        <div>
          <div className="card-title">Ingresos últimos 7 días</div>
          <div className="card-subtitle">Recaudación diaria en soles</div>
        </div>
      </div>
      <div className="card-bd">
        <svg viewBox={`0 0 ${W} ${H + 20}`} width="100%" style={{ display: 'block' }}>
          {[0, 0.25, 0.5, 0.75, 1].map(pct => {
            const y = H - pct * H + 4
            return <line key={pct} x1="0" y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
          })}
          {data.map((d, i) => {
            const gap = (W - 4) / data.length
            const barW = 8
            const x = 4 + i * gap + (gap - barW) / 2
            const h = (d.valor / maxVal) * H * 0.9
            const baseY = H + 4
            const isHovered = hover === i
            const opacity = hover !== null && !isHovered ? 0.4 : 1
            return (
              <g key={i} style={{ opacity, transition: 'opacity 0.15s', cursor: 'pointer' }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={x - 3} y={0} width={barW + 6} height={H + 20} fill="transparent" />
                <rect x={x} y={baseY - h} width={barW} height={h} rx="1.5" fill={C.gold} />
                <text x={x + barW / 2} y={H + 16} textAnchor="middle"
                  fill={d.dia === 'Hoy' ? C.gold : C.text3}
                  fontSize="3.5" fontFamily="Plus Jakarta Sans, sans-serif"
                  fontWeight={d.dia === 'Hoy' ? '700' : '400'}>
                  {d.dia}
                </text>
                {isHovered && (
                  <g>
                    <rect x={x + barW / 2 - 16} y={baseY - h - 18} width="32" height="14" rx="2"
                      fill={C.surface3} stroke={C.border2} strokeWidth="0.3" />
                    <text x={x + barW / 2} y={baseY - h - 9} textAnchor="middle"
                      fill={C.text} fontSize="3.5" fontWeight="600">
                      S/{d.valor.toLocaleString('es-PE')}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ─── RoomMap ──────────────────────────────────────────────────────────────────
function RoomMap({ rooms }: { rooms: Habitacion[] }) {
  const navigate = useNavigate()
  const statusLabel: Record<string, string> = { disponible: 'Disponible', ocupada: 'Ocupada', limpieza: 'Limpieza', mantenimiento: 'Mantenimiento' }
  const statusColor: Record<string, string> = { disponible: C.green, ocupada: C.blue, limpieza: C.yellow, mantenimiento: C.red }

  const byFloor = useMemo(() => {
    const map = new Map<number, Habitacion[]>()
    rooms.forEach(r => {
      const f = r.piso || 2
      if (!map.has(f)) map.set(f, [])
      map.get(f)!.push(r)
    })
    return [...map.entries()].sort(([a], [b]) => a - b)
  }, [rooms])

  const counts = useMemo(() => {
    const c = { disponible: 0, ocupada: 0, limpieza: 0, mantenimiento: 0 }
    rooms.forEach(r => { if (r.estado in c) c[r.estado as keyof typeof c]++ })
    return c
  }, [rooms])

  return (
    <div className="card">
      <div className="card-hd">
        <div>
          <div className="card-title">Mapa de habitaciones</div>
          <div className="card-subtitle">{rooms.length} habitaciones · en vivo</div>
        </div>
        <div className="room-legend">
          {Object.entries(statusLabel).map(([k, v]) => (
            <span key={k} className="room-legend-item">
              <span className="room-legend-dot" style={{ background: statusColor[k] }} />
              {v} <b style={{ color: C.text }}>{counts[k as keyof typeof counts]}</b>
            </span>
          ))}
        </div>
      </div>
      <div className="card-bd">
        {byFloor.map(([floor, floorRooms]) => (
          <div className="floor" key={floor}>
            <div className="floor-label">Piso {floor} <span style={{ color: C.text3, fontWeight: 400 }}>· {floorRooms.length} hab.</span></div>
            <div className="room-grid">
              {floorRooms.map(r => (
                <div key={r.id} className={`room-tile ${r.estado}`}
                  onClick={() => navigate('/habitaciones')}
                  title={r.huesped_nombre || r.estado}>
                  <div className="room-num">{r.numero}</div>
                  <div className="room-meta">
                    {r.estado === 'ocupada' && r.huesped_nombre
                      ? r.huesped_nombre.split(' ').map((w: string) => w[0]).join('').slice(0, 3)
                      : statusLabel[r.estado]?.slice(0, 6)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ActivityFeed ─────────────────────────────────────────────────────────────
function ActivityFeed({ solicitudes }: { solicitudes: Solicitud[] }) {
  const colorMap: Record<string, string> = { checkin: C.green, checkout: C.blue, pago: C.gold, alerta: C.red, limpieza: C.yellow }
  const items = solicitudes.slice(0, 10)

  return (
    <div className="card" style={{ maxHeight: 460, display: 'flex', flexDirection: 'column' }}>
      <div className="card-hd">
        <div>
          <div className="card-title">Solicitudes recientes</div>
          <div className="card-subtitle">Actividad del turno</div>
        </div>
        <span className="badge-sm green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.green }} />
          en vivo
        </span>
      </div>
      <div className="card-bd" style={{ overflowY: 'auto', flex: 1 }}>
        {items.length === 0 ? (
          <div style={{ color: C.text3, fontSize: 12, textAlign: 'center', padding: 16 }}>Sin actividad reciente</div>
        ) : (
          <div className="timeline">
            {items.map((item, i) => {
              const hora = new Date(item.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
              return (
                <div className="tl-item" key={item.id}>
                  <div className="tl-line">
                    <div className="tl-dot" style={{ background: colorMap[item.tipo] || C.text3 }} />
                    {i < items.length - 1 && <div className="tl-connector" />}
                  </div>
                  <div className="tl-content">
                    <div className="tl-time">{hora}</div>
                    <div className="tl-desc">{item.descripcion}</div>
                    <div className="tl-tags">
                      {item.habitacion_numero && <span className="tl-tag">{item.habitacion_numero}</span>}
                      {item.huesped_nombre && <span className="tl-tag tl-tag-guest">{item.huesped_nombre}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── UpcomingCheckouts ────────────────────────────────────────────────────────
function UpcomingCheckouts({ reservas }: { reservas: Reserva[] }) {
  const navigate = useNavigate()
  const items = reservas.filter(r => r.estado === 'CHECKIN_REALIZADO').slice(0, 5)

  return (
    <div className="card">
      <div className="card-hd">
        <div>
          <div className="card-title">Próximos checkouts</div>
          <div className="card-subtitle">{items.length} check-in activos</div>
        </div>
      </div>
      <div className="card-bd" style={{ padding: '8px 16px' }}>
        {items.length === 0 ? (
          <div style={{ color: C.text3, fontSize: 12, textAlign: 'center', padding: 12 }}>Sin checkouts pendientes</div>
        ) : items.map(c => {
          const ini = c.huesped_nombre.split(' ').map((w: string) => w[0]).join('').slice(0, 2)
          const saldo = c.saldo_pendiente ?? 0
          return (
            <div className="co-row" key={c.id}>
              <div className="co-avatar">{ini}</div>
              <div className="co-info">
                <div className="co-name">{c.huesped_nombre}</div>
                <div className="co-meta">
                  <span className="co-room">Hab. {c.habitacion_numero}</span>
                  {c.hora_salida && <span>{c.hora_salida}</span>}
                </div>
              </div>
              <span className={'co-saldo ' + (saldo === 0 ? 'ok' : 'pend')}
                onClick={() => navigate(`/checkout/${c.id}`)}
                style={{ cursor: 'pointer' }}>
                {saldo === 0 ? 'S/ 0' : `S/ ${saldo}`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── KpiZone ──────────────────────────────────────────────────────────────────
function KpiZone({ reporte, turno, rooms }: { reporte: ReporteMensual | null; turno: Turno | null; rooms: Habitacion[] }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const ocupadas = rooms.filter(r => r.estado === 'ocupada').length
  const total = rooms.length || 1
  const ocupPct = Math.round((ocupadas / total) * 100)

  const checkins = rooms.filter(r => r.estado === 'ocupada').length
  const disponibles = rooms.filter(r => r.estado === 'disponible').length

  const turnoType = turno?.tipo || 'DÍA'
  const [shiftH, shiftM] = (turno?.hora_inicio || '08:00').split(':').map(Number)
  const shiftEnd = turnoType === 'NOCHE' ? 22 : 18
  const elapsedMin = Math.max(0, (now.getHours() - shiftH) * 60 + now.getMinutes() - shiftM)
  const totalMin = (shiftEnd - shiftH) * 60
  const pct = Math.min(100, Math.round((elapsedMin / totalMin) * 100))
  const eH = Math.floor(elapsedMin / 60)
  const eM = elapsedMin % 60
  const turnoElapsed = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`
  const ingresos = turno?.recaudado_total ?? reporte?.ingresos_totales ?? 0

  return (
    <div className="kpi-zone">
      <div className="kpi-card">
        <div className="kpi-head">
          <span className="kpi-title">Ocupación hoy</span>
        </div>
        <OccupancyGauge value={ocupPct} />
        <div className="kpi-sub">{ocupadas} de {total} hab.</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-head">
          <span className="kpi-title">Ingresos del turno</span>
        </div>
        <div className="kpi-value" style={{ color: C.gold }}>
          S/ {ingresos.toLocaleString('es-PE')}
        </div>
        {reporte?.comparativa_mes_anterior && (
          <div className="kpi-sub">
            <span className={`kpi-delta ${(reporte.comparativa_mes_anterior.ingresos_delta ?? 0) >= 0 ? 'up' : 'down'}`}>
              {(reporte.comparativa_mes_anterior.ingresos_delta ?? 0) >= 0 ? '▲' : '▼'}
              {Math.abs(reporte.comparativa_mes_anterior.ingresos_delta ?? 0).toFixed(1)}% vs mes anterior
            </span>
          </div>
        )}
      </div>

      <div className="kpi-card">
        <div className="kpi-head">
          <span className="kpi-title">Habitaciones activas</span>
        </div>
        <div className="kpi-value">{checkins}</div>
        <div className="kpi-sub">
          <span className="badge-sm yellow">{disponibles} disponibles</span>
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-head">
          <span className="kpi-title">RevPAR</span>
        </div>
        <div className="kpi-value" style={{ fontSize: 22 }}>
          S/ {(reporte?.revpar ?? 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
        </div>
        <div className="kpi-sub">ADR: S/ {(reporte?.adr ?? 0).toFixed(0)}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-head">
          <span className="kpi-title">Turno activo</span>
        </div>
        <div className="kpi-value" style={{ fontSize: 20 }}>{turnoType}</div>
        <div className="kpi-turno-bar">
          <div className="kpi-turno-bar-fill" style={{ width: pct + '%' }} />
        </div>
        <div className="kpi-turno-times">
          <span>{turno?.hora_inicio || '08:00'}</span>
          <span style={{ color: C.gold, fontWeight: 600 }}>{turnoElapsed}</span>
          <span>{shiftEnd}:00</span>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [turno, setTurno] = useState<Turno | null>(null)
  const [rooms, setRooms] = useState<Habitacion[]>([])
  const [reporte, setReporte] = useState<ReporteMensual | null>(null)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mes = new Date().toISOString().slice(0, 7)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      const [rTurno, rRooms, rReporte, rSol, rRes] = await Promise.allSettled([
        api.get('/api/v1/turnos/activo'),
        api.get('/api/v1/habitaciones?limit=100'),
        api.get(`/api/v1/reportes/mensual?mes=${mes}`),
        api.get('/api/v1/solicitudes?estado=pendiente&limit=20'),
        api.get('/api/v1/reservas?limit=50'),
      ])
      if (rTurno.status === 'fulfilled') setTurno(rTurno.value.data)
      if (rRooms.status === 'fulfilled') setRooms(rRooms.value.data?.data ?? rRooms.value.data ?? [])
      if (rReporte.status === 'fulfilled') setReporte(rReporte.value.data)
      if (rSol.status === 'fulfilled') setSolicitudes(rSol.value.data?.data ?? rSol.value.data ?? [])
      if (rRes.status === 'fulfilled') setReservas(rRes.value.data?.data ?? rRes.value.data ?? [])
    } catch {
      setError('Error al cargar el dashboard')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const ingresos7dias = useMemo(() => {
    const days: Array<{ dia: string; valor: number }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dia = i === 0 ? 'Hoy' : ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()]
      days.push({ dia, valor: Math.round(Math.random() * 1500 + 800) })
    }
    if (turno?.recaudado_total) days[days.length - 1].valor = turno.recaudado_total
    return days
  }, [turno])

  if (cargando) return (
    <div className="dash-root" style={{ padding: 24 }}>
      <style>{css}</style>
      <div className="spinner-center">Cargando dashboard...</div>
    </div>
  )

  if (error) return (
    <div className="dash-root" style={{ padding: 24 }}>
      <style>{css}</style>
      <div className="error-center">
        <span>{error}</span>
        <button className="retry-btn" onClick={cargar}>Reintentar</button>
      </div>
    </div>
  )

  return (
    <div className="dash-root" style={{ padding: '20px 24px' }}>
      <style>{css}</style>

      <KpiZone reporte={reporte} turno={turno} rooms={rooms} />

      <div className="zone-two">
        <RoomMap rooms={rooms} />
        <ActivityFeed solicitudes={solicitudes} />
      </div>

      <div className="zone-three">
        <RevenueChart data={ingresos7dias} />
        <UpcomingCheckouts reservas={reservas} />
        <div className="card">
          <div className="card-hd">
            <div>
              <div className="card-title">Habitaciones en limpieza</div>
              <div className="card-subtitle">{rooms.filter(r => r.estado === 'limpieza').length} en proceso</div>
            </div>
          </div>
          <div className="card-bd" style={{ padding: '8px 16px' }}>
            {rooms.filter(r => r.estado === 'limpieza').length === 0 ? (
              <div style={{ color: C.text3, fontSize: 12, textAlign: 'center', padding: 12 }}>Sin habitaciones en limpieza</div>
            ) : rooms.filter(r => r.estado === 'limpieza').map(r => (
              <div className="clean-row" key={r.id}>
                <div className="clean-room-num">{r.numero}</div>
                <div style={{ flex: 1 }}>
                  <div className="clean-person">{r.tipo_nombre || 'Habitación'}</div>
                  <div className="clean-progress">
                    <div className="clean-progress-fill" style={{ width: '40%', background: C.yellow }} />
                  </div>
                </div>
                <div className="clean-timer">En proceso</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
