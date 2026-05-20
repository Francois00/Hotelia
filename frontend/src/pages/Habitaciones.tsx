import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useSocket } from '../hooks/useSocket'
import { isGerente } from '../utils/auth'
import HabitacionForm from '../components/habitaciones/HabitacionForm'

interface HuespedActual {
  nombre: string
  apellido: string
  documento: string
  reserva_id: string
  fecha_entrada: string
  fecha_salida: string
  dias_restantes: number
}

interface Habitacion {
  id: string
  numero: string
  piso: number
  tipo: string
  estado: string
  capacidad: number
  capacidad_adultos?: number | null
  capacidad_ninos?: number
  tarifa_base: number
  tarifa_minima?: number | null
  tarifa_maxima?: number | null
  moneda_tarifa?: string
  descripcion?: string | null
  amenidades?: string[] | null
  fotos?: string[]
  visible_otas?: boolean
  tipo_custom_id?: string | null
  tarifa_sugerida_hoy?: number
  huesped_actual?: HuespedActual | null
}

interface HabitacionesResp { data: Habitacion[]; meta: { total: number } }

const estadoBadgeClass: Record<string, string> = {
  DISPONIBLE:       'bg-green-100 text-green-800 border-green-200',
  OCUPADA:          'bg-blue-100 text-blue-800 border-blue-200',
  LIMPIEZA:         'bg-yellow-100 text-yellow-800 border-yellow-200',
  MANTENIMIENTO:    'bg-orange-100 text-orange-800 border-orange-200',
  FUERA_DE_SERVICIO:'bg-red-100 text-red-800 border-red-200',
}

const estadoColHeader: Record<string, string> = {
  DISPONIBLE: 'text-green-700 bg-green-50',
  LIMPIEZA:   'text-yellow-700 bg-yellow-50',
  MANTENIMIENTO: 'text-orange-700 bg-orange-50',
}

const ESTADOS_DRAG = ['DISPONIBLE', 'LIMPIEZA', 'MANTENIMIENTO'] as const

const validTransitions: Record<string, string[]> = {
  DISPONIBLE:       ['LIMPIEZA', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'],
  OCUPADA:          ['LIMPIEZA'],
  LIMPIEZA:         ['DISPONIBLE', 'MANTENIMIENTO'],
  MANTENIMIENTO:    ['DISPONIBLE', 'FUERA_DE_SERVICIO'],
  FUERA_DE_SERVICIO:['MANTENIMIENTO'],
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)

function SlideOver({ room, onClose, onEstadoChange }: {
  room: Habitacion
  onClose: () => void
  onEstadoChange: (id: string, estado: string) => Promise<void>
}) {
  const transitions = validTransitions[room.estado] ?? []
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-96 bg-white h-full shadow-2xl flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Habitación {room.numero}</h2>
            <p className="text-sm text-gray-500">{room.tipo} · Piso {room.piso} · {formatCurrency(room.tarifa_base)}/noche</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${estadoBadgeClass[room.estado] ?? 'bg-gray-100 text-gray-800 border-gray-200'}`}>
            {room.estado}
          </span>
          {transitions.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Cambiar estado</p>
              <div className="space-y-2">
                {transitions.map(t => (
                  <button
                    key={t}
                    onClick={() => void onEstadoChange(room.id, t).then(onClose)}
                    className={`w-full px-4 py-2 text-sm rounded-lg border text-left font-medium transition-colors ${estadoBadgeClass[t] ?? 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    → {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SalidaBadge({ diasRestantes }: { diasRestantes: number }) {
  if (diasRestantes <= 0) return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">SALE HOY</span>
  )
  if (diasRestantes === 1) return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700">SALE MAÑANA</span>
  )
  return null
}

function ModalRenovar({ room, onClose, onSuccess }: {
  room: Habitacion
  onClose: () => void
  onSuccess: () => void
}) {
  const minDate = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]
  const [fechaSalida, setFechaSalida] = useState(minDate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    if (!room.huesped_actual) return
    setLoading(true)
    setError('')
    try {
      await api.patch(`/api/v1/reservas/${room.huesped_actual.reserva_id}/modificar`, {
        fecha_salida: fechaSalida,
        motivo: 'El huésped solicitó extensión de estadía',
      })
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? 'No se pudo renovar la estadía'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={!loading ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-96 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Renovar estadía — Hab. {room.numero}</h2>
        {room.huesped_actual && (
          <p className="text-sm text-gray-500">
            Huésped: <span className="font-medium text-gray-800">{room.huesped_actual.apellido}, {room.huesped_actual.nombre}</span>
          </p>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nueva fecha de salida</label>
          <input
            type="date"
            min={minDate}
            value={fechaSalida}
            onChange={e => setFechaSalida(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={() => void handleConfirm()} disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Guardando...' : 'Confirmar renovación'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalEliminar({ room, onClose, onConfirm, loading }: {
  room: Habitacion
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={!loading ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-96 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-red-700">Eliminar permanentemente — Hab. {room.numero}</h2>
        <p className="text-sm text-gray-600">
          Esta acción <strong>no se puede deshacer</strong>. La habitación y todos sus datos serán eliminados definitivamente de la base de datos.
        </p>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="flex-1 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {loading ? 'Eliminando...' : 'Eliminar permanentemente'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalBaja({ room, onClose, onConfirm, loading }: {
  room: Habitacion
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={!loading ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-96 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Dar de baja — Hab. {room.numero}</h2>
        <p className="text-sm text-gray-600">
          La habitación pasará a <strong>FUERA DE SERVICIO</strong> y dejará de aparecer en el mapa de disponibilidad.
        </p>
        {(room.estado === 'OCUPADA' || room.estado === 'RESERVADA') && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            La habitación está {room.estado}. El sistema rechazará la baja si tiene reservas activas.
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Procesando...' : 'Confirmar baja'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Habitaciones() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<'mapa' | 'lista'>('mapa')
  const [rooms, setRooms] = useState<Habitacion[]>([])
  const [dragging, setDragging] = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Habitacion | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [editRoom, setEditRoom] = useState<Habitacion | null | false>(false)
  const [bajaRoom, setBajaRoom] = useState<Habitacion | null>(null)
  const [bajaLoading, setBajaLoading] = useState(false)
  const [deleteRoom, setDeleteRoom] = useState<Habitacion | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [renovarRoom, setRenovarRoom] = useState<Habitacion | null>(null)
  const [toast, setToast] = useState('')
  const queryClient = useQueryClient()
  const socketRef = useSocket('housekeeping')
  const gerente = isGerente()

  const estadoFilter = searchParams.get('estado') ?? 'all'
  const pisoFilter   = searchParams.get('piso') ?? 'all'
  const tipoFilter   = searchParams.get('tipo') ?? 'all'

  const navigate = useNavigate()

  const { data: resp, refetch } = useQuery<HabitacionesResp | Habitacion[]>({
    queryKey: ['habitaciones'],
    queryFn: () => api.get<HabitacionesResp>('/api/v1/habitaciones?limit=100&incluir_huesped=true').then(r => r.data),
    refetchInterval: 30000,
  })

  useEffect(() => {
    if (!resp) return
    const arr = Array.isArray(resp) ? resp : resp.data
    setRooms(arr ?? [])
  }, [resp])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return
    socket.on('habitacion:estado_cambio', (data: { id: string; estado: string }) => {
      setRooms(prev => prev.map(r => r.id === data.id ? { ...r, estado: data.estado } : r))
    })
    return () => { socket.off('habitacion:estado_cambio') }
  }, [socketRef])

  const filteredRooms = rooms.filter(r => {
    if (estadoFilter !== 'all' && r.estado !== estadoFilter) return false
    if (pisoFilter !== 'all' && String(r.piso) !== pisoFilter) return false
    if (tipoFilter !== 'all' && r.tipo !== tipoFilter) return false
    return true
  })

  const pisos = [...new Set(rooms.map(r => r.piso))].sort((a, b) => a - b)
  const tipos = [...new Set(rooms.map(r => r.tipo))]

  const updateFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams)
    if (value === 'all') p.delete(key)
    else p.set(key, value)
    setSearchParams(p)
  }

  const handleEstadoChange = async (id: string, estado: string) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, estado } : r))
    try {
      await api.patch(`/api/v1/habitaciones/${id}/estado`, { estado })
    } catch {
      void refetch()
    }
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragging(id)
    e.dataTransfer.setData('habitacion_id', id)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetEstado: string) => {
    e.preventDefault()
    setDragOver(null)
    const id = e.dataTransfer.getData('habitacion_id')
    if (!id) return
    const room = rooms.find(r => r.id === id)
    if (!room || room.estado === targetEstado) return
    setRooms(prev => prev.map(r => r.id === id ? { ...r, estado: targetEstado } : r))
    try {
      await api.patch(`/api/v1/habitaciones/${id}/estado`, { estado: targetEstado })
    } catch { void refetch() }
    setDragging(null)
  }

  const handleFormSuccess = (updated: Habitacion) => {
    setRooms(prev => {
      const idx = prev.findIndex(r => r.id === updated.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
      return [...prev, updated]
    })
    setEditRoom(false)
    setToast(editRoom ? 'Habitación actualizada' : 'Habitación creada')
    void queryClient.invalidateQueries({ queryKey: ['habitaciones'] })
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleEliminar = async () => {
    if (!deleteRoom) return
    setDeleteLoading(true)
    try {
      await api.delete(`/api/v1/habitaciones/${deleteRoom.id}/permanente`)
      setRooms(prev => prev.filter(r => r.id !== deleteRoom.id))
      void queryClient.invalidateQueries({ queryKey: ['habitaciones'] })
      showToast(`Habitación ${deleteRoom.numero} eliminada`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? 'No se pudo eliminar la habitación'
      showToast(msg)
    } finally {
      setDeleteLoading(false)
      setDeleteRoom(null)
    }
  }

  const handleDarBaja = async () => {
    if (!bajaRoom) return
    setBajaLoading(true)
    try {
      await api.delete(`/api/v1/habitaciones/${bajaRoom.id}`)
      setRooms(prev => prev.filter(r => r.id !== bajaRoom.id))
      void queryClient.invalidateQueries({ queryKey: ['habitaciones'] })
      showToast(`Habitación ${bajaRoom.numero} dada de baja`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? 'No se pudo dar de baja la habitación'
      showToast(msg)
    } finally {
      setBajaLoading(false)
      setBajaRoom(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-gray-900 text-white rounded-xl shadow-xl text-sm font-medium">
          {toast}
        </div>
      )}

      {selectedRoom && (
        <SlideOver
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onEstadoChange={handleEstadoChange}
        />
      )}

      {editRoom !== false && (
        <HabitacionForm
          habitacion={editRoom}
          onClose={() => setEditRoom(false)}
          onSuccess={handleFormSuccess}
        />
      )}

      {bajaRoom && (
        <ModalBaja
          room={bajaRoom}
          onClose={() => setBajaRoom(null)}
          onConfirm={() => void handleDarBaja()}
          loading={bajaLoading}
        />
      )}

      {deleteRoom && (
        <ModalEliminar
          room={deleteRoom}
          onClose={() => setDeleteRoom(null)}
          onConfirm={() => void handleEliminar()}
          loading={deleteLoading}
        />
      )}

      {renovarRoom && (
        <ModalRenovar
          room={renovarRoom}
          onClose={() => setRenovarRoom(null)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ['habitaciones'] })
            showToast(`Estadía de Hab. ${renovarRoom.numero} renovada`)
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Habitaciones</h1>
          <p className="text-gray-500 text-sm mt-0.5">{rooms.length} habitaciones en total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {gerente && (
            <button
              onClick={() => setEditRoom(null)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              + Nueva habitación
            </button>
          )}
        </div>
      </div>

      {/* Tabs Mapa / Lista */}
      <div className="flex border-b border-gray-200">
        {(['mapa', 'lista'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              view === v ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {v === 'mapa' ? 'Mapa' : 'Lista'}
          </button>
        ))}
      </div>

      {/* ─── TAB MAPA ─── */}
      {view === 'mapa' && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: 'estado', val: estadoFilter, opts: ['all', 'DISPONIBLE', 'OCUPADA', 'LIMPIEZA', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'], label: 'Todos los estados' },
              { key: 'piso', val: pisoFilter, opts: ['all', ...pisos.map(String)], label: 'Todos los pisos' },
              { key: 'tipo', val: tipoFilter, opts: ['all', ...tipos], label: 'Todos los tipos' },
            ].map(f => (
              <select
                key={f.key}
                value={f.val}
                onChange={e => updateFilter(f.key, e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{f.label}</option>
                {f.opts.filter(o => o !== 'all').map(o => (
                  <option key={o} value={o}>{f.key === 'piso' ? `Piso ${o}` : o}</option>
                ))}
              </select>
            ))}
          </div>

          {/* Kanban */}
          <div className="grid grid-cols-3 gap-4">
            {ESTADOS_DRAG.map(estado => (
              <div
                key={estado}
                onDragOver={e => { e.preventDefault(); setDragOver(estado) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => void handleDrop(e, estado)}
                className={`rounded-2xl border-2 transition-colors ${
                  dragOver === estado ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className={`px-4 py-3 rounded-t-xl border-b border-gray-200 flex items-center justify-between ${estadoColHeader[estado] ?? 'bg-gray-50 text-gray-700'}`}>
                  <span className="text-sm font-semibold">{estado}</span>
                  <span className="text-xs font-bold bg-white/70 px-2 py-0.5 rounded-full">
                    {filteredRooms.filter(r => r.estado === estado).length}
                  </span>
                </div>
                <div className="p-3 space-y-2 min-h-32">
                  {filteredRooms.filter(r => r.estado === estado).map(r => (
                    <div
                      key={r.id}
                      draggable
                      onDragStart={e => handleDragStart(e, r.id)}
                      onClick={() => setSelectedRoom(r)}
                      className={`bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all select-none ${dragging === r.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900 text-sm">Hab. {r.numero}</span>
                        <span className="text-xs text-gray-400">Piso {r.piso}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{r.tipo}</span>
                        <span className="text-xs text-gray-600 font-medium">{formatCurrency(r.tarifa_base)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Habitaciones OCUPADAS — tarjetas con huésped */}
          {filteredRooms.filter(r => r.estado === 'OCUPADA').length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-100 text-blue-800 border-blue-200">OCUPADA</span>
                <span className="text-xs text-gray-400">{filteredRooms.filter(r => r.estado === 'OCUPADA').length} habitaciones</span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredRooms.filter(r => r.estado === 'OCUPADA').map(r => {
                  const h = r.huesped_actual
                  return (
                    <div key={r.id} className="border border-blue-200 rounded-xl p-4 bg-blue-50/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-800 text-sm">HAB. {r.numero}</span>
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border bg-blue-100 text-blue-800 border-blue-200">OCUPADA</span>
                          {h && <SalidaBadge diasRestantes={h.dias_restantes} />}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Tipo: {r.tipo}</p>
                      {h ? (
                        <>
                          <div className="border-t border-blue-200 pt-2 space-y-1">
                            <p className="text-xs font-semibold text-gray-800">
                              {h.apellido.toUpperCase()}, {h.nombre}
                            </p>
                            <p className={`text-xs ${h.dias_restantes <= 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                              Salida: {h.fecha_salida}
                              {h.dias_restantes > 0 && ` (${h.dias_restantes} día${h.dias_restantes !== 1 ? 's' : ''})`}
                            </p>
                          </div>
                          <div className="border-t border-blue-200 pt-2 flex gap-2">
                            <button
                              onClick={() => setRenovarRoom(r)}
                              className="flex-1 px-2 py-1.5 text-xs font-medium bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                              Renovar
                            </button>
                            <button
                              onClick={() => navigate(`/checkout/${h.reserva_id}`)}
                              className="flex-1 px-2 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Checkout
                            </button>
                          </div>
                        </>
                      ) : (
                        <button onClick={() => setSelectedRoom(r)}
                          className="text-xs text-blue-600 hover:underline">Ver detalle</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* FUERA DE SERVICIO */}
          {filteredRooms.filter(r => r.estado === 'FUERA_DE_SERVICIO').length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-red-100 text-red-800 border-red-200">FUERA DE SERVICIO</span>
                <span className="text-xs text-gray-400">{filteredRooms.filter(r => r.estado === 'FUERA_DE_SERVICIO').length}</span>
              </div>
              <div className="p-5 flex flex-wrap gap-1.5">
                {filteredRooms.filter(r => r.estado === 'FUERA_DE_SERVICIO').map(r => (
                  <button key={r.id} onClick={() => setSelectedRoom(r)}
                    className="p-2 rounded-lg text-xs font-semibold border transition-all hover:scale-105 bg-red-100 text-red-800 border-red-200">
                    {r.numero}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* By floor */}
          {pisos.map(piso => {
            const pisoRooms = filteredRooms.filter(r => r.piso === piso)
            if (!pisoRooms.length) return null
            return (
              <div key={piso} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-900">Piso {piso}</h3>
                  <span className="text-xs text-gray-400">{pisoRooms.length} habitaciones</span>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {pisoRooms.map(r => (
                    <button key={r.id} onClick={() => setSelectedRoom(r)} draggable onDragStart={e => handleDragStart(e, r.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:scale-105 ${estadoBadgeClass[r.estado] ?? 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                      {r.numero}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* ─── TAB LISTA ─── */}
      {view === 'lista' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            {[
              { key: 'piso', val: pisoFilter, opts: pisos.map(String), label: 'Piso' },
              { key: 'tipo', val: tipoFilter, opts: tipos, label: 'Tipo' },
              { key: 'estado', val: estadoFilter, opts: ['DISPONIBLE','OCUPADA','LIMPIEZA','MANTENIMIENTO','FUERA_DE_SERVICIO'], label: 'Estado' },
            ].map(f => (
              <select
                key={f.key}
                value={f.val}
                onChange={e => updateFilter(f.key, e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos los {f.label.toLowerCase()}s</option>
                {f.opts.map(o => <option key={o} value={o}>{f.key === 'piso' ? `Piso ${o}` : o}</option>)}
              </select>
            ))}
            <span className="text-xs text-gray-400 ml-auto">{filteredRooms.length} resultados</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nro.', 'Piso', 'Tipo', 'Estado', 'Capacidad', 'Tarifa base', 'Tarifa IA hoy', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRooms.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Sin habitaciones</td></tr>
                )}
                {filteredRooms.map(r => {
                  const ia = r.tarifa_sugerida_hoy
                  const iaColor = ia == null ? '' : ia > r.tarifa_base ? 'text-green-600 font-medium' : ia < r.tarifa_base ? 'text-red-500 font-medium' : 'text-gray-600'
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{r.numero}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.piso}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.tipo}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${estadoBadgeClass[r.estado] ?? 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                          {r.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {r.capacidad_adultos ?? r.capacidad} adultos
                        {(r.capacidad_ninos ?? 0) > 0 && ` · ${r.capacidad_ninos} niños`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-medium">{formatCurrency(r.tarifa_base)}</td>
                      <td className={`px-4 py-3 text-sm ${iaColor}`}>
                        {ia != null ? formatCurrency(ia) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {gerente && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); setEditRoom(r) }}
                              className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedRoom(r) }}
                              className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              Estado
                            </button>
                            {r.estado !== 'FUERA_DE_SERVICIO' && (
                              <button
                                onClick={e => { e.stopPropagation(); setBajaRoom(r) }}
                                className="px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                Dar de baja
                              </button>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteRoom(r) }}
                              className="px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-100 rounded-lg transition-colors"
                              title="Eliminar permanentemente"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
