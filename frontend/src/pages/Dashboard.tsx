import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ResponsiveContainer
} from 'recharts'
import api from '../api/client'
import ia from '../api/ia'
import { useSocket } from '../hooks/useSocket'
import SolicitudesWidget from '../components/SolicitudesWidget'

interface KPIs {
  ingresos_totales: number
  num_reservas: number
  ocupacion_pct: number
  adr: number
  revpar: number
  comparativa_mes_anterior?: { ingresos_delta: number; ocupacion_delta: number; revpar_delta: number }
}

interface ForecastItem {
  fecha: string
  ocupacion_predicha: number
  intervalo_inferior: number
  intervalo_superior: number
  alerta?: boolean
}

interface Forecast { predicciones: ForecastItem[] }

interface Alerta {
  id: string
  tipo: string
  mensaje: string
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA'
  activa: boolean
  created_at: string
}

interface Habitacion {
  id: string
  numero: string
  piso: number
  tipo: string
  estado: string
  tarifa_base: number
  descripcion?: string
}

interface ReservaRaw {
  id: string
  codigo: string
  estado: string
  huesped_nombre?: string
  habitacion_numero?: string
  habitacion_id?: string
  huesped?: { nombre: string; apellido: string }
  habitacion?: { id: string; numero: string }
  fecha_entrada: string
  fecha_salida: string
  tarifa_acordada?: number
  total_estimado?: number
  num_noches?: number
}

function normReserva(r: ReservaRaw): Reserva {
  return {
    id:                r.id,
    codigo:            r.codigo,
    huesped_nombre:    r.huesped_nombre ?? (r.huesped ? `${r.huesped.nombre} ${r.huesped.apellido}`.trim() : ''),
    habitacion_numero: r.habitacion_numero ?? r.habitacion?.numero ?? '',
    habitacion_id:     r.habitacion_id ?? r.habitacion?.id ?? '',
    fecha_entrada:     r.fecha_entrada,
    fecha_salida:      r.fecha_salida,
    estado:            r.estado,
    tarifa_acordada:   r.tarifa_acordada ?? r.total_estimado ?? 0,
    num_noches:        r.num_noches,
  }
}

interface Reserva {
  id: string
  codigo: string
  huesped_nombre: string
  habitacion_numero: string
  habitacion_id: string
  fecha_entrada: string
  fecha_salida: string
  estado: string
  tarifa_acordada: number
  num_noches?: number
}

interface RoomAlerta { id: string; tipo: string; mensaje: string }
interface MaintenanceRisk { riesgo: number; factores: string[] }

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)

const today = format(new Date(), 'yyyy-MM-dd')

const estadoBadge: Record<string, string> = {
  DISPONIBLE: 'bg-green-100 text-green-800',
  OCUPADA: 'bg-blue-100 text-blue-800',
  LIMPIEZA: 'bg-yellow-100 text-yellow-800',
  MANTENIMIENTO: 'bg-orange-100 text-orange-800',
  FUERA_DE_SERVICIO: 'bg-red-100 text-red-800',
}

const validTransitions: Record<string, string[]> = {
  DISPONIBLE: ['LIMPIEZA', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'],
  OCUPADA: ['LIMPIEZA'],
  LIMPIEZA: ['DISPONIBLE', 'MANTENIMIENTO'],
  MANTENIMIENTO: ['DISPONIBLE', 'FUERA_DE_SERVICIO'],
  FUERA_DE_SERVICIO: ['MANTENIMIENTO'],
}

const prioridadColor: Record<string, string> = {
  ALTA: 'border-l-red-500',
  MEDIA: 'border-l-yellow-500',
  BAJA: 'border-l-blue-500',
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-gray-900 text-white rounded-xl shadow-xl text-sm font-medium">
      {msg}
    </div>
  )
}

function RoomSlideOver({
  room, onClose, onEstadoChange
}: {
  room: Habitacion
  onClose: () => void
  onEstadoChange: (id: string, estado: string) => void
}) {
  const [alertas, setAlertas] = useState<RoomAlerta[]>([])
  const [risk, setRisk] = useState<MaintenanceRisk | null>(null)

  useEffect(() => {
    api.get<RoomAlerta[]>(`/api/v1/habitaciones/${room.id}/alertas`)
      .then(r => setAlertas(r.data))
      .catch(() => {})
    ia.get<MaintenanceRisk>(`/ia/v1/mantenimiento/habitacion/${room.id}`)
      .then(r => setRisk(r.data))
      .catch(() => {})
  }, [room.id])

  const transitions = validTransitions[room.estado] ?? []

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-96 bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Hab. {room.numero}</h2>
            <p className="text-sm text-gray-500">{room.tipo} · Piso {room.piso}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoBadge[room.estado] ?? 'bg-gray-100 text-gray-800'}`}>
              {room.estado}
            </span>
          </div>

          {risk && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-4">
              <p className="text-sm font-medium text-orange-800 mb-1">Riesgo de mantenimiento: {(risk.riesgo * 100).toFixed(0)}%</p>
              {risk.factores.length > 0 && (
                <ul className="text-xs text-orange-700 space-y-0.5">
                  {risk.factores.map((f, i) => <li key={i}>• {f}</li>)}
                </ul>
              )}
            </div>
          )}

          {alertas.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Alertas activas</p>
              <div className="space-y-2">
                {alertas.map(a => (
                  <div key={a.id} className="text-sm p-3 bg-red-50 border border-red-100 rounded-lg text-red-700">
                    <span className="font-medium">{a.tipo}:</span> {a.mensaje}
                  </div>
                ))}
              </div>
            </div>
          )}

          {transitions.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Cambiar estado</p>
              <div className="grid grid-cols-1 gap-2">
                {transitions.map(t => (
                  <button
                    key={t}
                    onClick={() => { onEstadoChange(room.id, t); onClose() }}
                    className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium transition-colors text-left"
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

function RenovarModal({
  reserva, onClose, onConfirm
}: {
  reserva: Reserva
  onClose: () => void
  onConfirm: (nuevaFecha: string, noches: number, tarifa: number) => void
}) {
  const [nuevaFecha, setNuevaFecha] = useState(reserva.fecha_salida)
  const [tarifa, setTarifa] = useState(reserva.tarifa_acordada)

  const noches = Math.max(0, Math.round(
    (new Date(nuevaFecha).getTime() - new Date(reserva.fecha_salida).getTime()) / 86400000
  ))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-96 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Renovar estadía</h2>
        <p className="text-sm text-gray-500 mb-5">Reserva {reserva.codigo} · {reserva.huesped_nombre}</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva fecha de salida</label>
            <input
              type="date"
              value={nuevaFecha}
              min={reserva.fecha_salida}
              onChange={e => setNuevaFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa por noche (PEN)</label>
            <input
              type="number"
              value={tarifa}
              onChange={e => setTarifa(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {noches > 0 && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
              {noches} noche(s) adicional(es) · Total: {formatCurrency(noches * tarifa)}
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            disabled={noches <= 0}
            onClick={() => onConfirm(nuevaFecha, noches, tarifa)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const queryClient = useQueryClient()
  const socketRef = useSocket('dashboard')
  const [toast, setToast] = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Habitacion | null>(null)
  const [renovarReserva, setRenovarReserva] = useState<Reserva | null>(null)

  const showToast = useCallback((msg: string) => setToast(msg), [])

  const { data: kpis } = useQuery<KPIs>({
    queryKey: ['kpis'],
    queryFn: () => api.get<KPIs>('/api/v1/revenue/kpis').then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: forecast } = useQuery<Forecast>({
    queryKey: ['forecast-14'],
    queryFn: () => api.get<Forecast>('/api/v1/revenue/forecast?dias=14').then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: alertasData, refetch: refetchAlertas } = useQuery<Alerta[]>({
    queryKey: ['alertas'],
    queryFn: () => api.get<{ data: Alerta[] }>('/api/v1/alertas?activa=true&limit=5').then(r => r.data.data),
    refetchInterval: 30000,
  })

  const { data: habitaciones, refetch: refetchHabitaciones } = useQuery<Habitacion[]>({
    queryKey: ['habitaciones-dash'],
    queryFn: () => api.get<{ data: Habitacion[] }>('/api/v1/habitaciones?limit=200').then(r => r.data.data),
    refetchInterval: 30000,
  })

  const { data: checkins, refetch: refetchCheckins } = useQuery<Reserva[]>({
    queryKey: ['checkins-today'],
    queryFn: () => api.get<{ data: ReservaRaw[] } | ReservaRaw[]>(`/api/v1/reservas?estado=CONFIRMADA&fecha_entrada=${today}`)
      .then(r => (Array.isArray(r.data) ? r.data : (r.data.data ?? [])).map(normReserva)),
    refetchInterval: 30000,
  })

  const { data: checkouts, refetch: refetchCheckouts } = useQuery<Reserva[]>({
    queryKey: ['checkouts-today'],
    queryFn: () => api.get<{ data: ReservaRaw[] } | ReservaRaw[]>(`/api/v1/reservas?estado=CHECKIN_REALIZADO&fecha_salida=${today}`)
      .then(r => (Array.isArray(r.data) ? r.data : (r.data.data ?? [])).map(normReserva)),
    refetchInterval: 30000,
  })

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    socket.on('habitacion:estado_cambio', () => {
      queryClient.invalidateQueries({ queryKey: ['habitaciones-dash'] })
    })
    socket.on('reserva:nueva', () => { void refetchCheckins() })
    socket.on('alerta:nueva', () => { void refetchAlertas() })
    socket.on('kpis:update', () => {
      queryClient.invalidateQueries({ queryKey: ['kpis'] })
    })

    return () => {
      socket.off('habitacion:estado_cambio')
      socket.off('reserva:nueva')
      socket.off('alerta:nueva')
      socket.off('kpis:update')
    }
  }, [socketRef, queryClient, refetchCheckins, refetchAlertas])

  const handleCheckin = async (id: string) => {
    try {
      await api.patch(`/api/v1/reservas/${id}/estado`, { estado: 'CHECKIN_REALIZADO' })
      void refetchCheckins()
      showToast('Check-in realizado')
    } catch { showToast('Error al realizar check-in') }
  }

  const handleCheckout = async (id: string) => {
    try {
      await api.patch(`/api/v1/reservas/${id}/estado`, { estado: 'CHECKOUT_REALIZADO' })
      void refetchCheckouts()
      showToast('Checkout realizado')
    } catch { showToast('Error al realizar checkout') }
  }

  const handleRenovar = async (nuevaFecha: string, noches: number, tarifa: number) => {
    if (!renovarReserva) return
    try {
      await api.patch(`/api/v1/reservas/${renovarReserva.id}`, { fecha_salida: nuevaFecha })
      await api.post(`/api/v1/reservas/${renovarReserva.id}/folio/items`, {
        concepto: 'Extensión de estadía',
        categoria: 'HABITACION',
        cantidad: noches,
        precio_unitario: tarifa,
      })
      void refetchCheckouts()
      showToast('Estadía renovada')
    } catch { showToast('Error al renovar estadía') }
    setRenovarReserva(null)
  }

  const handleAlertaResuelta = async (id: string) => {
    try {
      await api.patch(`/api/v1/alertas/${id}/resolver`)
      void refetchAlertas()
    } catch { showToast('Error al resolver alerta') }
  }

  const handleEstadoChange = async (id: string, estado: string) => {
    try {
      await api.patch(`/api/v1/habitaciones/${id}/estado`, { estado })
      void refetchHabitaciones()
      showToast(`Estado cambiado a ${estado}`)
    } catch { showToast('Error al cambiar estado') }
  }

  const totalHabitaciones = habitaciones?.length ?? 1
  const ocupacion = kpis ? Math.round(kpis.ocupacion_pct) : 0

  const forecastData = forecast?.predicciones ?? []

  return (
    <div className="p-6 space-y-6">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      {selectedRoom && (
        <RoomSlideOver
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onEstadoChange={handleEstadoChange}
        />
      )}
      {renovarReserva && (
        <RenovarModal
          reserva={renovarReserva}
          onClose={() => setRenovarReserva(null)}
          onConfirm={handleRenovar}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">{format(new Date(), "EEEE d 'de' MMMM, yyyy")}</p>
        </div>
      </div>

      {/* Solicitudes de huéspedes pendientes */}
      <SolicitudesWidget />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Revenue Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{kpis ? formatCurrency(kpis.ingresos_totales) : '—'}</p>
          {kpis?.comparativa_mes_anterior && (
            <p className={`text-xs mt-1 font-medium ${kpis.comparativa_mes_anterior.ingresos_delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {kpis.comparativa_mes_anterior.ingresos_delta >= 0 ? '▲' : '▼'} vs mes anterior
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ocupación</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{ocupacion}%</p>
          <p className="text-xs text-gray-500 mt-1">{kpis?.num_reservas ?? 0} de {totalHabitaciones} hab.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ADR</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{kpis ? formatCurrency(kpis.adr) : '—'}</p>
          <p className="text-xs text-gray-500 mt-1">Tarifa media diaria</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">RevPAR</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{kpis ? formatCurrency(kpis.revpar) : '—'}</p>
          <p className="text-xs text-gray-500 mt-1">Revenue por habitación</p>
        </div>
      </div>

      {/* Forecast + Alertas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Forecast de Ocupación (14 días)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={forecastData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="fecha"
                tickFormatter={d => format(parseISO(d), 'dd/MM')}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    ocupacion_predicha: 'Predicción',
                    intervalo_superior: 'Límite superior',
                    intervalo_inferior: 'Límite inferior',
                  }
                  return [`${Number(value).toFixed(1)}%`, labels[String(name)] ?? String(name)]
                }}
                labelFormatter={l => format(parseISO(String(l)), 'dd/MM/yyyy')}
              />
              <Area type="monotone" dataKey="intervalo_superior" fill="#3B82F6" fillOpacity={0.15} stroke="none" />
              <Area type="monotone" dataKey="intervalo_inferior" fill="white" fillOpacity={1} stroke="none" />
              <Line type="monotone" dataKey="ocupacion_predicha" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Alertas Activas</h2>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {!alertasData?.length && (
              <p className="text-sm text-gray-400 py-4 text-center">Sin alertas activas</p>
            )}
            {alertasData?.map(a => (
              <div key={a.id} className={`border-l-4 ${prioridadColor[a.prioridad] ?? 'border-l-gray-300'} bg-gray-50 rounded-r-lg p-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700">{a.tipo}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.mensaje}</p>
                  </div>
                  <button
                    onClick={() => void handleAlertaResuelta(a.id)}
                    className="text-xs text-gray-400 hover:text-green-600 shrink-0 font-medium"
                    title="Marcar resuelta"
                  >
                    ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Check-ins / Check-outs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Check-ins de hoy</h2>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{checkins?.length ?? 0}</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {!checkins?.length && (
              <p className="text-sm text-gray-400 py-6 text-center">Sin check-ins pendientes</p>
            )}
            {checkins?.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.huesped_nombre}</p>
                  <p className="text-xs text-gray-500">Hab. {r.habitacion_numero} · {r.codigo}</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() => void handleCheckin(r.id)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 whitespace-nowrap"
                  >
                    Check-in
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Check-outs de hoy</h2>
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">{checkouts?.length ?? 0}</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {!checkouts?.length && (
              <p className="text-sm text-gray-400 py-6 text-center">Sin checkouts pendientes</p>
            )}
            {checkouts?.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.huesped_nombre}</p>
                  <p className="text-xs text-gray-500">Hab. {r.habitacion_numero} · {r.codigo}</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() => setRenovarReserva(r)}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 whitespace-nowrap"
                  >
                    Renovar
                  </button>
                  <button
                    onClick={() => void handleCheckout(r.id)}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 whitespace-nowrap"
                  >
                    Checkout
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Room Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Estado de habitaciones</h2>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {habitaciones?.map(h => (
              <button
                key={h.id}
                onClick={() => setSelectedRoom(h)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all hover:scale-105 ${estadoBadge[h.estado] ?? 'bg-gray-100 text-gray-800'} border-transparent`}
                title={`${h.estado} · ${h.tipo}`}
              >
                {h.numero}
              </button>
            ))}
            {!habitaciones?.length && (
              <p className="text-sm text-gray-400 py-4">Sin habitaciones disponibles</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
