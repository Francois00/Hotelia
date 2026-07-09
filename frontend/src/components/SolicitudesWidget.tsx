import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

interface Solicitud {
  id: string
  habitacion_numero: string
  reserva_id: string | null
  tipo: string
  descripcion: string
  estado: string
  atendido_por_nombre: string | null
  created_at: string
  atendido_at: string | null
}

const TIPO_ICONO: Record<string, string> = {
  limpieza: '🧹',
  room_service: '🍽️',
  mantenimiento: '🔧',
  informacion: 'ℹ️',
  late_checkout: '🕐',
  otro: '📋',
}

function tiempoTranscurrido(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  return hrs < 24 ? `${hrs} h` : `${Math.floor(hrs / 24)} d`
}

export default function SolicitudesWidget() {
  const qc = useQueryClient()
  const prevCountRef = useRef(0)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const { data: solicitudes = [] } = useQuery<Solicitud[]>({
    queryKey: ['solicitudes-pendientes'],
    queryFn: () => api.get<Solicitud[]>('/api/v1/solicitudes?estado=pendiente').then(r => r.data),
    refetchInterval: 30_000,
  })

  const atender = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      api.patch(`/api/v1/solicitudes/${id}`, { estado }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['solicitudes-pendientes'] }),
  })

  // Alerta sonora cuando llega una solicitud nueva
  useEffect(() => {
    if (solicitudes.length > prevCountRef.current) {
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
        const ctx = audioCtxRef.current
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.4)
      } catch {
        // AudioContext not available in some contexts
      }
    }
    prevCountRef.current = solicitudes.length
  }, [solicitudes.length])

  if (solicitudes.length === 0) return null

  return (
    <div className="bg-bg-card rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <h3 className="text-sm font-semibold text-amber-800">Solicitudes de huéspedes</h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold">
          {solicitudes.length}
        </span>
      </div>
      <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
        {solicitudes.map(s => (
          <div key={s.id} className="px-4 py-3 flex items-start gap-3 hover:bg-bg-secondary transition-colors">
            <span className="text-xl mt-0.5">{TIPO_ICONO[s.tipo] ?? '📋'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-800 bg-bg-tertiary px-1.5 py-0.5 rounded">
                  Hab. {s.habitacion_numero}
                </span>
                <span className="text-xs text-text-secondary capitalize">{s.tipo.replace('_', ' ')}</span>
                <span className="text-xs text-text-tertiary ml-auto shrink-0">{tiempoTranscurrido(s.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700 mt-0.5 truncate">{s.descripcion}</p>
            </div>
            <button
              onClick={() => atender.mutate({ id: s.id, estado: 'atendiendo' })}
              disabled={atender.isPending}
              className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium bg-success-bg text-success hover:bg-success-bg disabled:opacity-50 transition-colors"
            >
              ✓ Atender
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
