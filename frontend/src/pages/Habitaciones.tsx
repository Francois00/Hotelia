import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useRol } from '../hooks/useRol'

// ─── Types ────────────────────────────────────────────────────────────────────
interface TipoHab { id: string; nombre: string; precio_base: number; capacidad: number }
interface Habitacion {
  id: string; numero: string; piso: number; estado: string
  tipo_id?: string; tipo_nombre?: string; tarifa_base?: number; capacidad?: number
  reserva_id?: string; huesped_nombre?: string; hora_salida?: string
}

type EstadoFiltro = 'todas' | 'disponible' | 'ocupada' | 'limpieza' | 'mantenimiento'

const C = {
  bg: '#070A10', surface: '#0D1017', surface2: '#12171F', surface3: '#1B2131',
  border: 'rgba(255,255,255,0.06)', border2: 'rgba(255,255,255,0.1)',
  text: '#F0F4F8', text2: '#8A9AB5', text3: '#556070',
  green: '#22C55E', blue: '#4D96FF', yellow: '#EAB308', red: '#EF4444',
}

const ESTADO_LABEL: Record<string, string> = { disponible: 'Libre', ocupada: 'Ocup.', limpieza: 'Limpieza', mantenimiento: 'Manten.' }
const ESTADO_COLOR: Record<string, string> = { disponible: C.green, ocupada: C.blue, limpieza: C.yellow, mantenimiento: C.red }

const css = `
.hab-root{background:${C.bg};color:${C.text};min-height:100%;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;flex-direction:column;}
.hab-root *{box-sizing:border-box;}
.hdr{display:flex;align-items:center;gap:16px;padding:14px 20px;background:${C.surface};border-bottom:1px solid ${C.border};flex-shrink:0;}
.hdr-brand{display:flex;align-items:center;gap:10px;}
.hdr-name{font-size:14px;font-weight:700;color:${C.text};}
.hdr-sub{font-size:11px;color:${C.text3};}
.hdr-spacer{flex:1;}
.tally{display:flex;gap:8px;}
.tally-chip{display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;background:${C.surface2};font-size:12px;}
.tally-chip .bar{width:3px;height:20px;border-radius:2px;}
.tally-chip .n{font-size:16px;font-weight:700;line-height:1;color:${C.text};}
.tally-chip .l{font-size:10px;color:${C.text3};}
.tally-chip.green .bar{background:${C.green};}.tally-chip.blue .bar{background:${C.blue};}.tally-chip.yellow .bar{background:${C.yellow};}.tally-chip.red .bar{background:${C.red};}
.filters{display:flex;align-items:center;gap:6px;padding:10px 20px;flex-wrap:wrap;flex-shrink:0;border-bottom:1px solid ${C.border};}
.pill{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;border:1px solid ${C.border};background:transparent;color:${C.text2};font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;}
.pill:hover{border-color:${C.border2};color:${C.text};}
.pill.on{color:${C.text};font-weight:600;}
.pill.green.on{background:rgba(34,197,94,0.12);border-color:rgba(34,197,94,0.3);color:${C.green};}
.pill.blue.on{background:rgba(77,150,255,0.12);border-color:rgba(77,150,255,0.3);color:${C.blue};}
.pill.yellow.on{background:rgba(234,179,8,0.12);border-color:rgba(234,179,8,0.3);color:${C.yellow};}
.pill.red.on{background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.3);color:${C.red};}
.pill.all.on,.pill.floor.on{background:${C.surface2};border-color:${C.border2};color:${C.text};}
.pdot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.pcount{background:${C.surface3};border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;}
.fdiv{width:1px;height:20px;background:${C.border2};margin:0 4px;}
.board{flex:1;overflow-y:auto;padding:16px 20px;}
.floor-sec{margin-bottom:20px;}
.floor-hd{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.pn{font-size:12px;font-weight:700;color:${C.text2};text-transform:uppercase;letter-spacing:0.06em;}
.fl-line{flex:1;height:1px;background:${C.border};}
.fl-meta{font-size:11px;color:${C.text3};}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(184px,1fr));gap:12px;}
.cell{position:relative;overflow:hidden;border-radius:12px;}
.cell-actions{position:absolute;right:0;top:0;bottom:0;width:88px;display:flex;align-items:center;justify-content:center;z-index:0;}
.qa{width:80px;height:100%;border:none;border-radius:0 12px 12px 0;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font-size:11px;font-weight:700;}
.qa.green{background:rgba(34,197,94,0.2);color:${C.green};}.qa.blue{background:rgba(77,150,255,0.2);color:${C.blue};}.qa.yellow{background:rgba(234,179,8,0.2);color:${C.yellow};}.qa.red{background:rgba(239,68,68,0.2);color:${C.red};}
.card{position:relative;z-index:1;background:${C.surface2};border:1px solid ${C.border};border-radius:12px;padding:14px;cursor:pointer;transition:border-color 0.2s;user-select:none;}
.card:hover{border-color:${C.border2};}
.card.disponible{border-color:rgba(34,197,94,0.12);}.card.ocupada{border-color:rgba(77,150,255,0.12);}.card.limpieza{border-color:rgba(234,179,8,0.12);}.card.mantenimiento{border-color:rgba(239,68,68,0.12);}
.card.urgent{border-color:rgba(239,68,68,0.4)!important;box-shadow:0 0 0 1px rgba(239,68,68,0.2);}
.card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.card-num{font-size:18px;font-weight:800;color:${C.text};font-variant-numeric:tabular-nums;}
.statebadge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;}
.statebadge.disponible{background:rgba(34,197,94,0.15);color:${C.green};}.statebadge.ocupada{background:rgba(77,150,255,0.15);color:${C.blue};}.statebadge.limpieza{background:rgba(234,179,8,0.15);color:${C.yellow};}.statebadge.mantenimiento{background:rgba(239,68,68,0.15);color:${C.red};}
.card-type{font-size:11px;color:${C.text3};margin-bottom:10px;}
.card-mid{min-height:48px;}
.card-price{font-size:16px;font-weight:700;color:${C.text};margin-bottom:4px;}
.per{font-size:11px;color:${C.text3};font-weight:400;}
.card-line{font-size:11px;color:${C.text3};display:flex;align-items:center;gap:5px;margin-bottom:3px;}
.card-guest{font-size:13px;font-weight:700;color:${C.text};margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.salechip{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;}
.salechip.hoy{background:rgba(239,68,68,0.15);color:${C.red};}.salechip.manana{background:rgba(234,179,8,0.12);color:${C.yellow};}
.card-line.tech{color:${C.red};}
.card-foot{margin-top:10px;}
.cta{width:100%;padding:9px;border-radius:8px;border:none;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:opacity 0.15s;}
.cta:hover{opacity:0.85;}
.cta.green{background:rgba(34,197,94,0.15);color:${C.green};}.cta.blue{background:rgba(77,150,255,0.15);color:${C.blue};}.cta.yellow{background:rgba(234,179,8,0.12);color:${C.yellow};}
.cta.ghost{background:${C.surface3};color:${C.text2};}
.cta.split{display:flex;gap:6px;}.cta.split button{flex:1;}
.scrim{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:200;cursor:pointer;}
.sheet{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(480px,100vw);background:${C.surface};border-radius:20px 20px 0 0;border:1px solid ${C.border};z-index:201;padding:20px;max-height:85vh;overflow-y:auto;}
.sheet-hd{display:flex;align-items:center;gap:12px;margin-bottom:16px;}
.sheet-num{font-size:28px;font-weight:800;color:${C.text};}
.meta{flex:1;}.sub{font-size:12px;color:${C.text3};margin-top:2px;}
.sheet-close{background:${C.surface3};border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${C.text2};flex-shrink:0;}
.sheet-body{display:flex;flex-direction:column;gap:14px;}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.info-tile{background:${C.surface2};border-radius:8px;padding:10px 12px;}
.info-tile .k{font-size:10px;color:${C.text3};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;}
.info-tile .v{font-size:14px;font-weight:700;color:${C.text};}.info-tile .v.sm{font-size:12px;}
.sheet-actions{display:flex;flex-direction:column;gap:8px;}
.big-btn{width:100%;padding:12px;border-radius:10px;border:none;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;}
.big-btn.green{background:rgba(34,197,94,0.15);color:${C.green};}.big-btn.blue{background:rgba(77,150,255,0.15);color:${C.blue};}.big-btn.red{background:rgba(239,68,68,0.12);color:${C.red};}.big-btn.yellow{background:rgba(234,179,8,0.12);color:${C.yellow};}
.med-btn{width:100%;padding:9px;border-radius:8px;border:1px solid ${C.border};background:${C.surface2};color:${C.text2};font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;}
.btn-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.guest-card{display:flex;align-items:center;gap:12px;background:${C.surface2};border-radius:10px;padding:12px;}
.guest-av{width:44px;height:44px;border-radius:50%;background:${C.surface3};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:${C.blue};flex-shrink:0;}
.guest-name{font-size:15px;font-weight:700;color:${C.text};}
.guest-meta{font-size:11px;color:${C.text3};margin-top:2px;}
.banner{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:600;}
.banner.red{background:rgba(239,68,68,0.12);color:${C.red};}.banner.yellow{background:rgba(234,179,8,0.1);color:${C.yellow};}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${C.surface};border:1px solid ${C.border2};border-radius:24px;padding:10px 20px;font-size:13px;font-weight:500;color:${C.text};z-index:300;display:flex;align-items:center;gap:8px;box-shadow:0 8px 32px rgba(0,0,0,0.4);}
.tcheck{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.tcheck.green{background:rgba(34,197,94,0.2);color:${C.green};}.tcheck.blue{background:rgba(77,150,255,0.2);color:${C.blue};}.tcheck.yellow{background:rgba(234,179,8,0.15);color:${C.yellow};}.tcheck.red{background:rgba(239,68,68,0.15);color:${C.red};}
.empty{text-align:center;color:${C.text3};font-size:14px;padding:40px;}
.spinner-center{display:flex;align-items:center;justify-content:center;flex:1;color:${C.text3};font-size:14px;padding:40px;}
.error-center{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:12px;color:${C.text3};padding:40px;}
.retry-btn{padding:8px 16px;background:${C.surface2};border:1px solid ${C.border2};border-radius:8px;color:${C.text};cursor:pointer;font-size:13px;}
`

// ─── RoomCard ─────────────────────────────────────────────────────────────────
function RoomCard({ room, tipos, onTap, onQuick }: {
  room: Habitacion; tipos: TipoHab[]; onTap: () => void; onQuick: () => void
}) {
  const tipo = tipos.find(t => t.id === room.tipo_id)
  const price = tipo?.precio_base ?? room.tarifa_base ?? 0
  const qaColor = { disponible: 'green', ocupada: 'blue', limpieza: 'yellow', mantenimiento: 'red' }[room.estado] || 'green'
  const qaLabel = { disponible: 'Check-in', ocupada: 'Salida', limpieza: 'Lista', mantenimiento: 'Orden' }[room.estado] || ''

  return (
    <div className="cell">
      <div className="cell-actions">
        <button className={`qa ${qaColor}`} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onQuick() }}>
          {qaLabel}
        </button>
      </div>
      <div className={`card ${room.estado}`} onClick={onTap}>
        <div className="card-top">
          <span className="card-num">{room.numero}</span>
          <span className={`statebadge ${room.estado}`}>{ESTADO_LABEL[room.estado]}</span>
        </div>
        <div className="card-type">{tipo?.nombre ?? room.tipo_nombre ?? 'Habitación'}</div>
        <div className="card-mid">
          {room.estado === 'disponible' && (
            <>
              <div className="card-price">S/ {price} <span className="per">/ noche</span></div>
              <div className="card-line">Hasta {tipo?.capacidad ?? room.capacidad ?? 2} personas</div>
            </>
          )}
          {room.estado === 'ocupada' && (
            <>
              <div className="card-guest">{room.huesped_nombre || 'Huésped'}</div>
              {room.hora_salida && <div className="card-line"><span className="salechip hoy">Sale {room.hora_salida}</span></div>}
            </>
          )}
          {room.estado === 'limpieza' && <div className="card-line" style={{ color: C.yellow, fontWeight: 700 }}>🧹 En limpieza</div>}
          {room.estado === 'mantenimiento' && <div className="card-line tech">🔧 En mantenimiento</div>}
        </div>
        <div className="card-foot">
          {room.estado === 'disponible' && <button className="cta green" onClick={e => { e.stopPropagation(); onTap() }}>Check-in →</button>}
          {room.estado === 'ocupada' && (
            <div className="cta split">
              <button className="cta ghost" style={{ height: 38 }} onClick={e => { e.stopPropagation(); onTap() }}>↻ Renovar</button>
              <button className="cta blue" style={{ height: 38 }} onClick={e => { e.stopPropagation(); onQuick() }}>Salida →</button>
            </div>
          )}
          {room.estado === 'limpieza' && <button className="cta yellow" onClick={e => { e.stopPropagation(); onQuick() }}>✓ Marcar lista</button>}
          {room.estado === 'mantenimiento' && <button className="cta ghost" onClick={e => { e.stopPropagation(); onTap() }}>Ver orden</button>}
        </div>
      </div>
    </div>
  )
}

// ─── Sheet modal ──────────────────────────────────────────────────────────────
function Sheet({ room, tipos, onClose, onAction }: {
  room: Habitacion; tipos: TipoHab[]; onClose: () => void; onAction: (room: Habitacion, action: string) => void
}) {
  const tipo = tipos.find(t => t.id === room.tipo_id)
  const ini = (room.huesped_nombre ?? '').split(' ').map((w: string) => w[0]).join('').slice(0, 2)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-hd">
          <span className="sheet-num">{room.numero}</span>
          <div className="meta">
            <span className={`statebadge ${room.estado}`}>
              {{ disponible: 'Disponible', ocupada: 'Ocupada', limpieza: 'En limpieza', mantenimiento: 'Mantenimiento' }[room.estado]}
            </span>
            <div className="sub">{tipo?.nombre ?? room.tipo_nombre} · Piso {room.piso} · S/ {tipo?.precio_base ?? room.tarifa_base ?? 0}/noche</div>
          </div>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          {room.estado === 'disponible' && (
            <>
              <div className="info-grid">
                <div className="info-tile"><div className="k">Tipo</div><div className="v sm">{tipo?.nombre ?? room.tipo_nombre}</div></div>
                <div className="info-tile"><div className="k">Tarifa</div><div className="v">S/ {tipo?.precio_base ?? room.tarifa_base ?? 0}</div></div>
                <div className="info-tile"><div className="k">Capacidad</div><div className="v sm">Hasta {tipo?.capacidad ?? room.capacidad ?? 2}</div></div>
                <div className="info-tile"><div className="k">Piso</div><div className="v">{room.piso}</div></div>
              </div>
              <div className="sheet-actions">
                <button className="big-btn green" onClick={() => { onAction(room, 'checkin'); onClose() }}>✓ Hacer check-in</button>
                <div className="btn-row">
                  <button className="med-btn" onClick={() => { onAction(room, 'reportar'); onClose() }}>🔧 Reportar problema</button>
                  <button className="med-btn" onClick={() => { onAction(room, 'bloquear'); onClose() }}>🔒 Bloquear</button>
                </div>
              </div>
            </>
          )}
          {room.estado === 'ocupada' && (
            <>
              <div className="guest-card">
                <div className="guest-av">{ini}</div>
                <div>
                  <div className="guest-name">{room.huesped_nombre || 'Huésped'}</div>
                  <div className="guest-meta">{tipo?.nombre ?? room.tipo_nombre} · S/ {tipo?.precio_base ?? room.tarifa_base ?? 0}/noche</div>
                </div>
              </div>
              {room.hora_salida && <div className="banner red">⚠ Sale hoy a las {room.hora_salida}</div>}
              <div className="info-grid">
                <div className="info-tile"><div className="k">Salida</div><div className="v sm">{room.hora_salida || 'Por definir'}</div></div>
                <div className="info-tile"><div className="k">Piso</div><div className="v">{room.piso}</div></div>
              </div>
              <div className="sheet-actions">
                <button className="big-btn blue" onClick={() => { onAction(room, 'renovar'); onClose() }}>↻ Renovar estadía</button>
                <button className="big-btn red" onClick={() => { onAction(room, 'checkout'); onClose() }}>↩ Hacer checkout</button>
              </div>
            </>
          )}
          {room.estado === 'limpieza' && (
            <>
              <div className="banner yellow">🧹 Habitación en limpieza</div>
              <div className="sheet-actions">
                <button className="big-btn yellow" onClick={() => { onAction(room, 'lista'); onClose() }}>✓ Marcar como lista</button>
              </div>
            </>
          )}
          {room.estado === 'mantenimiento' && (
            <>
              <div className="banner red">🔧 En mantenimiento</div>
              <div className="sheet-actions">
                <button className="big-btn red" onClick={() => { onAction(room, 'verorden'); onClose() }}>📋 Ver parte de trabajo</button>
                <button className="med-btn" onClick={() => { onAction(room, 'resolver'); onClose() }}>✓ Marcar resuelta</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Habitaciones() {
  const navigate = useNavigate()
  const { tienePermiso } = useRol()
  const isRecepcionista = tienePermiso('reservas.gestionar')

  const [rooms, setRooms] = useState<Habitacion[]>([])
  const [tipos, setTipos] = useState<TipoHab[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [estado, setEstado] = useState<EstadoFiltro>('todas')
  const [floorSet, setFloorSet] = useState(new Set<number>())
  const [selected, setSelected] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; color: string } | null>(null)

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const [rH, rT] = await Promise.all([
        api.get('/api/v1/habitaciones?limit=100'),
        api.get('/api/v1/tipos-habitacion').catch(() => ({ data: [] })),
      ])
      setRooms(rH.data?.data ?? rH.data ?? [])
      setTipos(rT.data?.data ?? rT.data ?? [])
    } catch { setError('Error al cargar habitaciones') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const showToast = (text: string, color = 'green') => {
    setToast({ text, color })
    setTimeout(() => setToast(null), 2600)
  }

  const patchEstado = useCallback(async (roomId: string, nuevoEstado: string) => {
    try {
      await api.patch(`/api/v1/habitaciones/${roomId}/estado`, { estado: nuevoEstado })
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, estado: nuevoEstado } : r))
    } catch { showToast('Error al actualizar estado', 'red') }
  }, [])

  const onAction = useCallback(async (room: Habitacion, action: string) => {
    switch (action) {
      case 'checkin':
        if (isRecepcionista) navigate('/checkin'); break
      case 'checkout':
        if (room.reserva_id) navigate(`/checkout/${room.reserva_id}`)
        else showToast('Sin reserva activa para checkout', 'yellow'); break
      case 'renovar':
        showToast(`Estadía renovada · ${room.numero}`, 'blue'); break
      case 'lista':
        await patchEstado(room.id, 'disponible')
        showToast(`Habitación ${room.numero} lista`, 'yellow'); break
      case 'reportar':
        await patchEstado(room.id, 'mantenimiento')
        showToast(`Problema reportado · ${room.numero}`, 'red'); break
      case 'resolver':
        await patchEstado(room.id, 'disponible')
        showToast(`Mantenimiento resuelto · ${room.numero}`, 'green'); break
      case 'bloquear':
        showToast(`Habitación ${room.numero} bloqueada`, 'yellow'); break
      default: break
    }
  }, [navigate, patchEstado, isRecepcionista])

  const onQuick = useCallback((room: Habitacion) => {
    const map: Record<string, string> = { disponible: 'checkin', ocupada: 'checkout', limpieza: 'lista', mantenimiento: 'verorden' }
    onAction(room, map[room.estado] || 'checkin')
  }, [onAction])

  const toggleFloor = (p: number) => setFloorSet(s => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n })

  const floors = [...new Set(rooms.map(r => r.piso))].sort((a, b) => a - b)
  const tallies = {
    total: rooms.length,
    disponible: rooms.filter(r => r.estado === 'disponible').length,
    ocupada: rooms.filter(r => r.estado === 'ocupada').length,
    limpieza: rooms.filter(r => r.estado === 'limpieza').length,
    mantenimiento: rooms.filter(r => r.estado === 'mantenimiento').length,
  }

  const visibleFloors = floors
    .filter(f => floorSet.size === 0 || floorSet.has(f))
    .map(f => ({ piso: f, shown: rooms.filter(r => r.piso === f && (estado === 'todas' || r.estado === estado)) }))
    .filter(f => f.shown.length > 0)

  const selectedRoom = rooms.find(r => r.id === selected)

  return (
    <div className="hab-root" style={{ height: '100%' }}>
      <style>{css}</style>

      <div className="hdr">
        <div className="hdr-brand">
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1E3A5F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏨</div>
          <div><div className="hdr-name">Mapa de habitaciones</div><div className="hdr-sub">Recepción · en vivo</div></div>
        </div>
        <div className="hdr-spacer" />
        <div className="tally">
          {['green', 'blue', 'yellow', 'red'].map((color, i) => {
            const keys = ['disponible', 'ocupada', 'limpieza', 'mantenimiento']
            const labels = ['Libres', 'Ocupadas', 'Limpieza', 'Manten.']
            return (
              <div key={color} className={`tally-chip ${color}`}>
                <span className="bar" />
                <div><div className="n">{tallies[keys[i] as keyof typeof tallies]}</div><div className="l">{labels[i]}</div></div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="filters">
        {[
          { key: 'todas', label: 'Todas', cls: 'all', n: tallies.total },
          { key: 'disponible', label: 'Disponible', cls: 'green', n: tallies.disponible },
          { key: 'ocupada', label: 'Ocupada', cls: 'blue', n: tallies.ocupada },
          { key: 'limpieza', label: 'Limpieza', cls: 'yellow', n: tallies.limpieza },
          { key: 'mantenimiento', label: 'Mantenimiento', cls: 'red', n: tallies.mantenimiento },
        ].map(it => (
          <button key={it.key} className={`pill ${it.cls}${estado === it.key ? ' on' : ''}`}
            onClick={() => setEstado(it.key as EstadoFiltro)}>
            {it.cls !== 'all' && <span className="pdot" style={{ background: ESTADO_COLOR[it.key] || '#888' }} />}
            {it.label} <span className="pcount">{it.n}</span>
          </button>
        ))}
        <div className="fdiv" />
        {floors.map(f => (
          <button key={f} className={`pill floor${floorSet.has(f) ? ' on' : ''}`} onClick={() => toggleFloor(f)}>
            Piso {f}
          </button>
        ))}
      </div>

      <div className="board">
        {cargando && <div className="spinner-center">Cargando habitaciones...</div>}
        {error && <div className="error-center"><span>{error}</span><button className="retry-btn" onClick={cargar}>Reintentar</button></div>}
        {!cargando && !error && visibleFloors.length === 0 && <div className="empty">Sin habitaciones que coincidan con el filtro</div>}
        {!cargando && !error && visibleFloors.map(f => (
          <section className="floor-sec" key={f.piso}>
            <div className="floor-hd">
              <span className="pn">Piso {f.piso}</span><span className="fl-line" /><span className="fl-meta">{f.shown.length} habitaciones</span>
            </div>
            <div className="grid">
              {f.shown.map(r => <RoomCard key={r.id} room={r} tipos={tipos} onTap={() => setSelected(r.id)} onQuick={() => onQuick(r)} />)}
            </div>
          </section>
        ))}
      </div>

      {selected && selectedRoom && <Sheet room={selectedRoom} tipos={tipos} onClose={() => setSelected(null)} onAction={onAction} />}

      {toast && (
        <div className="toast"><span className={`tcheck ${toast.color}`}>✓</span>{toast.text}</div>
      )}
    </div>
  )
}
