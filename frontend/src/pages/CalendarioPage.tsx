import { useState, useEffect } from 'react'
import api from '../api/client'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Habitacion { id: string; numero: string; piso: number; tipo_nombre?: string }
interface ReservaBar {
  id: string; habitacion_id: string; huesped_nombre: string
  fecha_checkin: string; fecha_checkout: string; canal: string; estado: string
}

const C = {
  bg: '#070A10', surface: '#0D1017', surface2: '#12171F', surface3: '#1B2131',
  border: 'rgba(255,255,255,0.06)', border2: 'rgba(255,255,255,0.1)',
  text: '#F0F4F8', text2: '#8A9AB5', text3: '#556070',
  green: '#22C55E', blue: '#4D96FF', yellow: '#EAB308', red: '#EF4444',
}

const CANAL_COLORS: Record<string, string> = {
  manual_recepcion: '#3b82f6',
  manual: '#3b82f6',
  whatsapp_ia: '#22c55e',
  whatsapp: '#22c55e',
  booking_com: '#4f46e5',
  booking: '#4f46e5',
  expedia: '#f97316',
  default: '#6b7280',
}
const canalColor = (canal: string) => CANAL_COLORS[canal] ?? CANAL_COLORS[Object.keys(CANAL_COLORS).find(k => canal.includes(k)) ?? ''] ?? CANAL_COLORS.default

const CANAL_LABEL: Record<string, string> = {
  manual_recepcion: 'Recepción', manual: 'Recepción', whatsapp_ia: 'WhatsApp', whatsapp: 'WhatsApp',
  booking_com: 'Booking', booking: 'Booking', expedia: 'Expedia',
}

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function fmtISO(d: Date) { return d.toISOString().split('T')[0] }
function fmtLabel(d: Date) { return `${d.getDate()} ${d.toLocaleDateString('es-PE', { month: 'short' })}` }
function isSameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString() }
function parseDate(s: string) { return new Date(s + 'T00:00:00') }

const COLS_WEEK = 14
const COLS_MONTH = 30
const ROW_H = 52

const css = `
.cal-root{display:flex;flex-direction:column;height:100%;background:${C.bg};color:${C.text};font-family:-apple-system,BlinkMacSystemFont,sans-serif;}
.cal-root *{box-sizing:border-box;}
.cal-hdr{display:flex;align-items:center;gap:10px;padding:12px 16px;background:${C.surface};border-bottom:1px solid ${C.border};flex-shrink:0;}
.cal-title{font-size:15px;font-weight:700;color:${C.text};}
.cal-hdr-spacer{flex:1;}
.nav-btn{padding:7px 12px;background:${C.surface2};border:1px solid ${C.border};border-radius:8px;color:${C.text2};font-size:13px;cursor:pointer;}
.nav-btn:hover{border-color:${C.border2};color:${C.text};}
.today-btn{padding:7px 14px;background:rgba(77,150,255,0.1);border:1px solid rgba(77,150,255,0.25);border-radius:8px;color:${C.blue};font-size:13px;font-weight:600;cursor:pointer;}
.view-toggle{display:flex;gap:2px;background:${C.surface2};border:1px solid ${C.border};border-radius:8px;padding:3px;}
.view-btn{padding:5px 12px;border-radius:6px;border:none;font-size:12px;font-weight:600;cursor:pointer;color:${C.text2};background:transparent;}
.view-btn.on{background:${C.surface3};color:${C.text};}
.legend{display:flex;align-items:center;gap:12px;padding:8px 16px;border-bottom:1px solid ${C.border};flex-shrink:0;background:${C.surface};}
.leg-item{display:flex;align-items:center;gap:5px;font-size:11px;color:${C.text3};}
.leg-dot{width:10px;height:10px;border-radius:3px;}
.gantt-wrap{flex:1;overflow:auto;display:flex;flex-direction:column;}
.gantt-head{display:flex;align-items:center;position:sticky;top:0;z-index:10;background:${C.surface};border-bottom:1px solid ${C.border};flex-shrink:0;}
.room-col{width:130px;min-width:130px;padding:8px 14px;border-right:1px solid ${C.border};font-size:11px;font-weight:700;color:${C.text3};text-transform:uppercase;letter-spacing:0.05em;}
.day-head-cols{display:grid;flex:1;}
.day-head{display:flex;align-items:center;justify-content:center;padding:8px 4px;font-size:11px;color:${C.text3};border-right:1px solid ${C.border};font-weight:600;}
.day-head.today{color:${C.blue};font-weight:800;}
.day-head.weekend{color:${C.text3};opacity:0.7;}
.floor-sec{flex-shrink:0;}
.floor-hd{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid ${C.border};background:${C.surface2};}
.floor-name{font-size:11px;font-weight:700;color:${C.text3};text-transform:uppercase;letter-spacing:0.06em;}
.floor-line{flex:1;height:1px;background:${C.border};}
.room-row{display:flex;align-items:stretch;border-bottom:1px solid ${C.border};height:${ROW_H}px;}
.room-cell{width:130px;min-width:130px;padding:0 14px;border-right:1px solid ${C.border};display:flex;flex-direction:column;justify-content:center;flex-shrink:0;}
.room-num{font-size:14px;font-weight:700;color:${C.text};}
.room-type{font-size:11px;color:${C.text3};}
.gantt-cells{flex:1;display:grid;position:relative;align-items:center;}
.day-cell{border-right:1px solid ${C.border};height:100%;position:relative;}
.day-cell.today-col{background:rgba(77,150,255,0.04);}
.day-cell.weekend-col{background:rgba(255,255,255,0.01);}
.bar{position:absolute;top:50%;transform:translateY(-50%);height:28px;border-radius:6px;cursor:pointer;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:2;transition:filter 0.15s;}
.bar:hover{filter:brightness(1.15);}
.bar-inner{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
.scrim{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:200;}
.drawer{position:fixed;right:0;top:0;bottom:0;width:min(360px,100vw);background:${C.surface};border-left:1px solid ${C.border};z-index:201;display:flex;flex-direction:column;}
.drw-hd{display:flex;align-items:center;gap:10px;padding:16px;border-bottom:1px solid ${C.border};}
.drw-title{font-size:16px;font-weight:800;color:${C.text};flex:1;}
.drw-close{background:${C.surface3};border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${C.text2};}
.drw-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px;}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.info-tile{background:${C.surface2};border-radius:8px;padding:10px 12px;}
.info-tile .k{font-size:10px;color:${C.text3};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;}
.info-tile .v{font-size:14px;font-weight:700;color:${C.text};}
.drw-actions{padding:16px;border-top:1px solid ${C.border};display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.big-btn{width:100%;padding:11px;border-radius:10px;border:none;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;}
.big-btn.blue{background:rgba(77,150,255,0.12);color:${C.blue};}.big-btn.red{background:rgba(239,68,68,0.1);color:${C.red};}.big-btn.green{background:rgba(34,197,94,0.1);color:${C.green};}
.canal-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700;}
.spinner-center{display:flex;align-items:center;justify-content:center;flex:1;color:${C.text3};font-size:14px;padding:40px;}
.error-center{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:12px;color:${C.text3};padding:40px;}
.retry-btn{padding:8px 16px;background:${C.surface2};border:1px solid ${C.border2};border-radius:8px;color:${C.text};cursor:pointer;font-size:13px;}
.empty{text-align:center;color:${C.text3};font-size:14px;padding:48px;}
`

// ─── Bar component ────────────────────────────────────────────────────────────
function Bar({ reserva, colStart, colSpan, cols, onClick }: {
  reserva: ReservaBar; colStart: number; colSpan: number; cols: number; onClick: () => void
}) {
  const color = canalColor(reserva.canal)
  const left = `${((colStart - 1) / cols) * 100}%`
  const width = `calc(${(colSpan / cols) * 100}% - 4px)`

  return (
    <div
      className="bar"
      style={{ left, width, background: color + '33', borderLeft: `3px solid ${color}`, color }}
      onClick={onClick}
    >
      <div className="bar-inner">{reserva.huesped_nombre}</div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CalendarioPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 2); return d
  })
  const [view, setView] = useState<'week' | 'month'>('week')
  const [rooms, setRooms] = useState<Habitacion[]>([])
  const [reservas, setReservas] = useState<ReservaBar[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const cols = view === 'week' ? COLS_WEEK : COLS_MONTH
  const today = new Date()
  const days = Array.from({ length: cols }, (_, i) => addDays(startDate, i))
  const endDate = addDays(startDate, cols - 1)

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const [rH, rR] = await Promise.all([
        api.get('/api/v1/habitaciones?limit=100'),
        api.get(`/api/v1/reservas?fecha_desde=${fmtISO(startDate)}&fecha_hasta=${fmtISO(endDate)}&limit=500`),
      ])
      setRooms(rH.data?.data ?? rH.data ?? [])
      setReservas(rR.data?.data ?? rR.data ?? [])
    } catch { setError('Error al cargar calendario') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [startDate, view])

  const navigate = (dir: 1 | -1) => setStartDate(d => addDays(d, dir * (view === 'week' ? 7 : 30)))

  const barsForRoom = (roomId: string) => {
    return reservas.filter(r => r.habitacion_id === roomId).map(r => {
      const ci = parseDate(r.fecha_checkin)
      const co = parseDate(r.fecha_checkout)
      const clampedStart = ci < startDate ? startDate : ci
      const clampedEnd = co > endDate ? endDate : co
      const colStart = days.findIndex(d => isSameDay(d, clampedStart)) + 1
      const rawColSpan = Math.ceil((clampedEnd.getTime() - clampedStart.getTime()) / 86400000)
      const colSpan = Math.min(rawColSpan, cols - colStart + 1)
      if (colStart < 1 || colSpan <= 0) return null
      return { reserva: r, colStart, colSpan }
    }).filter(Boolean) as { reserva: ReservaBar; colStart: number; colSpan: number }[]
  }

  const floors = [...new Set(rooms.map(r => r.piso))].sort()
  const selectedRes = reservas.find(r => r.id === selected)

  const gridTemplateColumns = `repeat(${cols}, minmax(44px, 1fr))`

  return (
    <div className="cal-root" style={{ height: '100%' }}>
      <style>{css}</style>

      <div className="cal-hdr">
        <span className="cal-title">Calendario de Reservas</span>
        <div className="cal-hdr-spacer" />
        <button className="today-btn" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 2); setStartDate(d) }}>Hoy</button>
        <button className="nav-btn" onClick={() => navigate(-1)}>←</button>
        <span style={{ fontSize: 13, color: C.text2, minWidth: 160, textAlign: 'center' }}>
          {fmtLabel(startDate)} — {fmtLabel(endDate)}
        </span>
        <button className="nav-btn" onClick={() => navigate(1)}>→</button>
        <div className="view-toggle">
          <button className={`view-btn${view === 'week' ? ' on' : ''}`} onClick={() => setView('week')}>2 semanas</button>
          <button className={`view-btn${view === 'month' ? ' on' : ''}`} onClick={() => setView('month')}>Mes</button>
        </div>
      </div>

      <div className="legend">
        <span style={{ fontSize: 11, color: C.text3, fontWeight: 600, marginRight: 4 }}>Canales:</span>
        {[
          { color: '#3b82f6', label: 'Recepción' },
          { color: '#22c55e', label: 'WhatsApp' },
          { color: '#4f46e5', label: 'Booking' },
          { color: '#f97316', label: 'Expedia' },
        ].map(it => (
          <div key={it.label} className="leg-item">
            <div className="leg-dot" style={{ background: it.color }} />
            {it.label}
          </div>
        ))}
      </div>

      {cargando && <div className="spinner-center">Cargando calendario...</div>}
      {error && <div className="error-center"><span>{error}</span><button className="retry-btn" onClick={cargar}>Reintentar</button></div>}

      {!cargando && !error && (
        <div className="gantt-wrap">
          <div className="gantt-head">
            <div className="room-col">Habitación</div>
            <div className="day-head-cols" style={{ display: 'grid', gridTemplateColumns, flex: 1 }}>
              {days.map((d, i) => {
                const isToday = isSameDay(d, today)
                const wd = d.getDay()
                const isWk = wd === 0 || wd === 6
                return (
                  <div key={i} className={`day-head${isToday ? ' today' : ''}${isWk ? ' weekend' : ''}`}>
                    <div>{d.toLocaleDateString('es-PE', { weekday: 'short' }).slice(0, 2)}</div>
                    <div style={{ fontWeight: 800 }}>{d.getDate()}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {rooms.length === 0 && <div className="empty">Sin habitaciones disponibles</div>}

          {floors.map(f => {
            const floorRooms = rooms.filter(r => r.piso === f)
            return (
              <div key={f} className="floor-sec">
                <div className="floor-hd">
                  <span className="floor-name">Piso {f}</span>
                  <span className="floor-line" />
                  <span style={{ fontSize: 11, color: C.text3 }}>{floorRooms.length} hab.</span>
                </div>
                {floorRooms.map(room => {
                  const bars = barsForRoom(room.id)
                  return (
                    <div key={room.id} className="room-row">
                      <div className="room-cell">
                        <div className="room-num">{room.numero}</div>
                        <div className="room-type">{room.tipo_nombre ?? ''}</div>
                      </div>
                      <div className="gantt-cells" style={{ gridTemplateColumns }}>
                        {days.map((d, i) => {
                          const isToday = isSameDay(d, today)
                          const wd = d.getDay()
                          const isWk = wd === 0 || wd === 6
                          return <div key={i} className={`day-cell${isToday ? ' today-col' : ''}${isWk ? ' weekend-col' : ''}`} />
                        })}
                        {bars.map(b => (
                          <Bar key={b.reserva.id} reserva={b.reserva} colStart={b.colStart} colSpan={b.colSpan} cols={cols} onClick={() => setSelected(b.reserva.id)} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {selected && selectedRes && (
        <>
          <div className="scrim" onClick={() => setSelected(null)} />
          <div className="drawer">
            <div className="drw-hd">
              <span className="drw-title">{selectedRes.huesped_nombre}</span>
              <button className="drw-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drw-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="canal-chip" style={{ background: canalColor(selectedRes.canal) + '22', color: canalColor(selectedRes.canal) }}>
                  {CANAL_LABEL[selectedRes.canal] ?? selectedRes.canal}
                </div>
                <div className="canal-chip" style={{ background: C.surface3, color: selectedRes.estado === 'confirmada' ? C.green : selectedRes.estado === 'cancelada' ? C.red : C.yellow }}>
                  {selectedRes.estado}
                </div>
              </div>
              <div className="info-grid">
                <div className="info-tile">
                  <div className="k">Check-in</div>
                  <div className="v" style={{ fontSize: 13 }}>{new Date(selectedRes.fecha_checkin + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
                </div>
                <div className="info-tile">
                  <div className="k">Check-out</div>
                  <div className="v" style={{ fontSize: 13 }}>{new Date(selectedRes.fecha_checkout + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
                </div>
                <div className="info-tile">
                  <div className="k">Noches</div>
                  <div className="v">{Math.ceil((parseDate(selectedRes.fecha_checkout).getTime() - parseDate(selectedRes.fecha_checkin).getTime()) / 86400000)}</div>
                </div>
                <div className="info-tile">
                  <div className="k">Habitación</div>
                  <div className="v">{rooms.find(r => r.id === selectedRes.habitacion_id)?.numero ?? '—'}</div>
                </div>
              </div>
            </div>
            <div className="drw-actions">
              <button className="big-btn blue" onClick={() => setSelected(null)}>✏ Editar</button>
              <button className="big-btn red" onClick={() => setSelected(null)}>✕ Cancelar</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
