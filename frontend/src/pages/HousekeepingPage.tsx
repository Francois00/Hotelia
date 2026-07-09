import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '../api/client'
import { useRol } from '../hooks/useRol'

// ─── Types ────────────────────────────────────────────────────────────────────

type Prioridad = 'urgente' | 'alta' | 'normal'
type Filtro = 'todas' | 'urgente' | 'alta' | 'en_proceso' | 'listas'

interface HabPlan {
  id: string
  numero: string
  piso: number
  tipo: string
  estado_actual: string
  prioridad: Prioridad
  razon_prioridad: string
  huesped_saliente: string | null
  huesped_entrante: string | null
  hora_checkin_estimada: string | null
  tiempo_en_estado: number
  notas_mantenimiento: string | null
}

interface Resumen {
  total: number
  urgentes: number
  alta: number
  pendientes: number
}

interface PlanDia {
  resumen: Resumen
  habitaciones: HabPlan[]
}

// ─── Timer en vivo ────────────────────────────────────────────────────────────

function useTiempoVivo(tiempoBase: number, enProceso: boolean) {
  const [minutos, setMinutos] = useState(tiempoBase)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    setMinutos(tiempoBase)
    if (!enProceso) return
    intervalRef.current = setInterval(() => setMinutos(m => m + 1), 60_000)
    return () => clearInterval(intervalRef.current)
  }, [tiempoBase, enProceso])

  return minutos
}

function TiempoLabel({ minutos, enProceso }: { minutos: number; enProceso: boolean }) {
  const hrs = Math.floor(minutos / 60)
  const mins = minutos % 60
  const texto = hrs > 0 ? `${hrs}h ${mins}min` : `${minutos} min`

  if (!enProceso) return <span className="text-text-secondary text-xs">⏱ {texto}</span>
  if (minutos > 90) return <span className="text-red-600 text-xs font-semibold">⚠ {texto} — exceso</span>
  if (minutos > 45) return <span className="text-orange-500 text-xs font-medium">⏱ {texto} — revisar</span>
  return <span className="text-blue-600 text-xs">⏱ {texto} en limpieza</span>
}

// ─── Modal confirmación ───────────────────────────────────────────────────────

function ModalConfirmar({
  numero, onClose, onConfirm,
}: {
  numero: string; onClose: () => void; onConfirm: (notas: string) => void
}) {
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg-card rounded-xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-gray-800 text-lg mb-2">✅ Marcar como lista</h3>
        <p className="text-sm text-text-secondary mb-4">
          ¿La habitación <span className="font-bold">{numero}</span> está lista para recibir huéspedes?
        </p>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Notas opcionales (ej: cambié toallas, falta papel)"
          className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-none focus:ring-2 focus:ring-green-300 outline-none"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border text-sm text-text-secondary hover:bg-bg-secondary">
            Cancelar
          </button>
          <button
            disabled={loading}
            onClick={async () => {
              setLoading(true)
              await new Promise(r => setTimeout(r, 0))
              onConfirm(notas)
            }}
            className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            ✅ Confirmar — Lista para ocupar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de habitación ───────────────────────────────────────────────────────

function HabCard({
  hab,
  enProceso,
  onIniciar,
  onMarcarLista,
}: {
  hab: HabPlan
  enProceso: boolean
  onIniciar: () => void
  onMarcarLista: () => void
}) {
  const minutos = useTiempoVivo(hab.tiempo_en_estado, enProceso)

  const esLista = hab.estado_actual === 'DISPONIBLE'

  const borderClass = esLista
    ? 'border-success bg-success-bg/30'
    : enProceso
    ? 'border-info bg-info-bg/20'
    : hab.prioridad === 'urgente'
    ? 'border-danger animate-pulse-border bg-danger-bg/20'
    : hab.prioridad === 'alta'
    ? 'border-orange-300 bg-orange-50/20'
    : 'border-border-primary bg-bg-card'

  const badgeClass = esLista
    ? 'bg-success-bg text-success'
    : enProceso
    ? 'bg-info-bg text-info'
    : hab.prioridad === 'urgente'
    ? 'bg-danger-bg text-danger'
    : hab.prioridad === 'alta'
    ? 'bg-orange-100 text-orange-800'
    : 'bg-bg-tertiary text-gray-700'

  const badgeIcon = esLista ? '✅' : enProceso ? '🔵' : hab.prioridad === 'urgente' ? '🔴' : hab.prioridad === 'alta' ? '🟠' : '⚪'
  const badgeLabel = esLista ? 'LISTA' : enProceso ? 'EN PROCESO' : hab.prioridad.toUpperCase()

  return (
    <div className={`rounded-xl border-2 ${borderClass} p-4 transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}>
            {badgeIcon} {badgeLabel}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-gray-800">HAB. {hab.numero}</span>
          <p className="text-xs text-text-tertiary">{hab.tipo} · Piso {hab.piso}</p>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="space-y-1.5 mb-3">
        {hab.huesped_saliente && (
          <p className="text-sm text-gray-700">
            <span className="text-text-tertiary">📤 Salió:</span>{' '}
            <span className="font-medium">{hab.huesped_saliente}</span>
          </p>
        )}
        {hab.huesped_entrante && (
          <p className="text-sm text-gray-700">
            <span className="text-text-tertiary">📥 Entra:</span>{' '}
            <span className="font-medium">{hab.huesped_entrante}</span>
            {hab.hora_checkin_estimada && (
              <span className="text-text-secondary"> a las {hab.hora_checkin_estimada}</span>
            )}
          </p>
        )}
        {!hab.huesped_entrante && (
          <p className="text-xs text-text-tertiary">📥 Sin reserva entrante hoy</p>
        )}
        <p className="text-xs text-text-secondary">{hab.razon_prioridad}</p>
        {(enProceso || hab.estado_actual === 'LIMPIEZA') && (
          <TiempoLabel minutos={minutos} enProceso={enProceso} />
        )}
        {hab.notas_mantenimiento && (
          <p className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
            🔧 Mantenimiento: {hab.notas_mantenimiento}
          </p>
        )}
      </div>

      {/* Acciones */}
      {!esLista && (
        <div className="flex gap-2 pt-2 border-t border-border-primary">
          {!enProceso && (
            <button
              onClick={onIniciar}
              className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              ▶ Iniciar limpieza
            </button>
          )}
          <button
            onClick={onMarcarLista}
            className="flex-1 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
          >
            ✓ Marcar como lista
          </button>
        </div>
      )}
      {esLista && (
        <p className="text-xs text-success pt-2 border-t border-success">
          ✓ Disponible
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HousekeepingPage() {
  const { esHousekeeping } = useRol()
  const qc = useQueryClient()

  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [pisoFiltro, setPisoFiltro] = useState<number | null>(null)
  // Track de habitaciones "en proceso" localmente (iniciadas por este usuario en esta sesión)
  const [enProceso, setEnProceso] = useState<Set<string>>(new Set())
  const [listas, setListas] = useState<Set<string>>(new Set())
  const [modalNumero, setModalNumero] = useState<string | null>(null)
  const [modalId, setModalId] = useState<string | null>(null)

  const { data: plan, isLoading, refetch } = useQuery<PlanDia>({
    queryKey: ['hk-plan'],
    queryFn: () => api.get<PlanDia>('/api/v1/housekeeping/plan-dia').then(r => r.data),
    refetchInterval: 120_000,
  })

  const cambiarEstado = useMutation({
    mutationFn: ({ numero, estado, notas }: { numero: string; estado: string; notas?: string }) =>
      api.patch(`/api/v1/housekeeping/habitaciones/${numero}/estado`, { estado, notas }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hk-plan'] })
      void qc.invalidateQueries({ queryKey: ['habitaciones'] })
    },
  })

  const iniciarLimpieza = useCallback((hab: HabPlan) => {
    setEnProceso(prev => new Set(prev).add(hab.id))
    cambiarEstado.mutate({ numero: hab.numero, estado: 'LIMPIEZA' })
  }, [cambiarEstado])

  const marcarLista = useCallback((notas: string) => {
    if (!modalNumero || !modalId) return
    setListas(prev => new Set(prev).add(modalId))
    setEnProceso(prev => { const s = new Set(prev); s.delete(modalId); return s })
    cambiarEstado.mutate({ numero: modalNumero, estado: 'DISPONIBLE', notas })
    setModalNumero(null); setModalId(null)
  }, [modalNumero, modalId, cambiarEstado])

  const habitaciones = plan?.habitaciones ?? []
  const pisos = [...new Set(habitaciones.map(h => h.piso))].sort()

  const filtradas = habitaciones.filter(h => {
    if (listas.has(h.id)) return filtro === 'listas' || filtro === 'todas'
    if (pisoFiltro !== null && h.piso !== pisoFiltro) return false
    if (filtro === 'urgente') return h.prioridad === 'urgente'
    if (filtro === 'alta') return h.prioridad === 'alta'
    if (filtro === 'en_proceso') return enProceso.has(h.id)
    if (filtro === 'listas') return h.estado_actual === 'DISPONIBLE'
    return true
  })

  const resumen = plan?.resumen

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      {/* Header */}
      <div className="bg-bg-card border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">🧹 Plan del día — Housekeeping</h1>
            <p className="text-sm text-text-secondary mt-0.5 capitalize">
              {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>
          <button
            onClick={() => void refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-secondary text-sm hover:bg-gray-200 transition-colors"
          >
            🔄 Actualizar
          </button>
        </div>

        {/* Badges resumen */}
        {resumen && (
          <div className="flex gap-3 mt-3 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-danger-bg text-danger text-xs font-semibold">
              🔴 Urgentes: {resumen.urgentes}
            </span>
            <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
              🟠 Alta: {resumen.alta}
            </span>
            <span className="px-3 py-1 rounded-full bg-info-bg text-info text-xs font-semibold">
              ⏳ En proceso: {enProceso.size}
            </span>
            <span className="px-3 py-1 rounded-full bg-success-bg text-success text-xs font-semibold">
              ✅ Listas: {listas.size}
            </span>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-bg-card border-b px-6 py-2 flex gap-2 flex-wrap">
        {([
          { key: 'todas', label: 'Todas' },
          { key: 'urgente', label: '🔴 Urgentes' },
          { key: 'alta', label: '🟠 Alta' },
          { key: 'en_proceso', label: '⏳ En proceso' },
          { key: 'listas', label: '✅ Listas' },
        ] as { key: Filtro; label: string }[]).map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filtro === f.key ? 'bg-blue-600 text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setPisoFiltro(null)}
            className={`px-2 py-1 rounded-full text-xs ${pisoFiltro === null ? 'bg-blue-600 text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-gray-200'}`}
          >
            Todos pisos
          </button>
          {pisos.map(p => (
            <button
              key={p}
              onClick={() => setPisoFiltro(p)}
              className={`px-2 py-1 rounded-full text-xs ${pisoFiltro === p ? 'bg-blue-600 text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-gray-200'}`}
            >
              Piso {p}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-center text-text-tertiary py-16 text-sm">Cargando plan del día...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-center text-text-tertiary py-16">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-sm font-medium text-text-secondary">
              {filtro === 'todas' ? 'No hay habitaciones pendientes de limpieza hoy' : 'Sin habitaciones en este filtro'}
            </p>
            {esHousekeeping && filtro === 'todas' && (
              <p className="text-xs text-text-tertiary mt-1">Todas las habitaciones están listas</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtradas.map(hab => (
              <HabCard
                key={hab.id}
                hab={hab}
                enProceso={enProceso.has(hab.id)}
                onIniciar={() => iniciarLimpieza(hab)}
                onMarcarLista={() => { setModalNumero(hab.numero); setModalId(hab.id) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalNumero && (
        <ModalConfirmar
          numero={modalNumero}
          onClose={() => { setModalNumero(null); setModalId(null) }}
          onConfirm={marcarLista}
        />
      )}
    </div>
  )
}
