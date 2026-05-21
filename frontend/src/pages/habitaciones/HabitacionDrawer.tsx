import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'

interface Habitacion {
  id: string; numero: string; piso: number; tipo: string; estado: string
  capacidad: number; capacidad_adultos?: number | null
  tarifa_base: number; descripcion?: string | null
  amenidades?: string[] | null
}

interface MReg {
  id: string; tipo_problema: string; descripcion: string
  tecnico_nombre: string | null; fecha_inicio: string
  fecha_fin: string | null; costo_estimado: string | null
  estado: string; prioridad: string; notas_cierre: string | null
  created_at: string
}

interface Props {
  room: Habitacion | null
  onClose: () => void
  onEstadoChanged?: () => void
}

const TIPO_OPTS = [
  { value: 'electrico',         label: 'Eléctrico' },
  { value: 'plomeria',          label: 'Plomería' },
  { value: 'mobiliario',        label: 'Mobiliario' },
  { value: 'climatizacion',     label: 'Climatización' },
  { value: 'limpieza_profunda', label: 'Limpieza profunda' },
  { value: 'otro',              label: 'Otro' },
]

const PRIORIDAD_BADGE: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700 border-red-200',
  alta:    'bg-orange-100 text-orange-700 border-orange-200',
  media:   'bg-blue-100 text-blue-700 border-blue-200',
  baja:    'bg-gray-100 text-gray-600 border-gray-200',
}

const ESTADO_BADGE: Record<string, string> = {
  pendiente:  'bg-yellow-100 text-yellow-700',
  en_proceso: 'bg-blue-100 text-blue-700',
  resuelto:   'bg-green-100 text-green-700',
  cancelado:  'bg-gray-100 text-gray-500',
}

const fmt = (n: string | number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(n))

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'info' | 'mantenimiento' | 'historial'

// ─── Info Tab ─────────────────────────────────────────────────────────────────

function TabInfo({ room }: { room: Habitacion }) {
  return (
    <div className="space-y-4 p-5">
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          ['Número',     room.numero],
          ['Piso',       room.piso],
          ['Tipo',       room.tipo],
          ['Estado',     room.estado],
          ['Capacidad',  `${room.capacidad_adultos ?? room.capacidad} adultos`],
          ['Tarifa base', fmt(room.tarifa_base)],
        ].map(([k, v]) => (
          <div key={String(k)} className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 font-medium">{k}</p>
            <p className="text-gray-900 font-semibold mt-0.5">{v}</p>
          </div>
        ))}
      </div>
      {room.descripcion && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
          <p className="text-xs text-gray-400 font-medium mb-1">Descripción</p>
          <p className="text-gray-700">{room.descripcion}</p>
        </div>
      )}
      {room.amenidades && room.amenidades.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 font-medium mb-2">Amenidades</p>
          <div className="flex flex-wrap gap-1.5">
            {room.amenidades.map(a => (
              <span key={a} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{a}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Mantenimiento Tab ────────────────────────────────────────────────────────

function TabMantenimiento({ room, onEstadoChanged }: { room: Habitacion; onEstadoChanged?: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ tipo_problema: 'electrico', descripcion: '', prioridad: 'media', tecnico_nombre: '', costo_estimado: '' })
  const [showForm, setShowForm] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [notasCierre, setNotasCierre] = useState('')

  const { data, isLoading } = useQuery<{ ok: boolean; data: MReg[] }>({
    queryKey: ['mantenimiento', room.id],
    queryFn: () => api.get(`/api/v1/habitaciones/${room.id}/mantenimiento`).then(r => r.data as { ok: boolean; data: MReg[] }),
  })

  const registros = data?.data ?? []

  const createMut = useMutation({
    mutationFn: (body: typeof form) => api.post(`/api/v1/habitaciones/${room.id}/mantenimiento`, {
      tipo_problema:  body.tipo_problema,
      descripcion:    body.descripcion,
      prioridad:      body.prioridad,
      tecnico_nombre: body.tecnico_nombre || undefined,
      costo_estimado: body.costo_estimado ? parseFloat(body.costo_estimado) : undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mantenimiento', room.id] })
      void qc.invalidateQueries({ queryKey: ['habitaciones'] })
      setForm({ tipo_problema: 'electrico', descripcion: '', prioridad: 'media', tecnico_nombre: '', costo_estimado: '' })
      setShowForm(false)
      onEstadoChanged?.()
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, estado, notas_cierre }: { id: string; estado: string; notas_cierre?: string }) =>
      api.patch(`/api/v1/mantenimiento/${id}`, { estado, notas_cierre }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mantenimiento', room.id] })
      void qc.invalidateQueries({ queryKey: ['habitaciones'] })
      setClosingId(null)
      setNotasCierre('')
      onEstadoChanged?.()
    },
  })

  const stats = {
    total:      registros.length,
    enProceso:  registros.filter(r => r.estado === 'en_proceso').length,
    costo:      registros.reduce((s, r) => s + (parseFloat(r.costo_estimado ?? '0') || 0), 0),
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 px-5 pt-4 pb-3">
        {[
          { label: 'Total', value: stats.total },
          { label: 'En proceso', value: stats.enProceso },
          { label: 'Costo total', value: fmt(stats.costo) },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-lg px-2 py-2 text-center">
            <p className="text-lg font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Form toggle */}
      <div className="px-5 pb-3">
        <button
          onClick={() => setShowForm(v => !v)}
          className="w-full px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-xl hover:bg-orange-700 transition-colors"
        >
          {showForm ? '— Cancelar' : '+ Reportar problema'}
        </button>
      </div>

      {showForm && (
        <div className="mx-5 mb-3 p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Tipo</label>
              <select
                value={form.tipo_problema}
                onChange={e => setForm(f => ({ ...f, tipo_problema: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Prioridad</label>
              <select
                value={form.prioridad}
                onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {['baja','media','alta','urgente'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Descripción *</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Describe el problema en detalle (mínimo 10 caracteres)"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Técnico (opc.)</label>
              <input
                type="text"
                value={form.tecnico_nombre}
                onChange={e => setForm(f => ({ ...f, tecnico_nombre: e.target.value }))}
                placeholder="Nombre del técnico"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Costo est. S/ (opc.)</label>
              <input
                type="number" step="0.01" min="0"
                value={form.costo_estimado}
                onChange={e => setForm(f => ({ ...f, costo_estimado: e.target.value }))}
                placeholder="0.00"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
          {form.prioridad === 'urgente' && (
            <p className="text-xs text-red-600 font-medium">⚠️ Prioridad URGENTE cambiará el estado de la habitación a Mantenimiento</p>
          )}
          <button
            onClick={() => createMut.mutate(form)}
            disabled={createMut.isPending || form.descripcion.length < 10}
            className="w-full px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            {createMut.isPending ? 'Guardando...' : 'Reportar'}
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
        {isLoading && <p className="text-sm text-gray-400 text-center pt-4">Cargando...</p>}
        {!isLoading && registros.length === 0 && (
          <p className="text-sm text-gray-400 text-center pt-8">Sin órdenes de mantenimiento</p>
        )}
        {registros.map(r => (
          <div key={r.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${PRIORIDAD_BADGE[r.prioridad] ?? ''}`}>
                    {r.prioridad.toUpperCase()}
                  </span>
                  <span className="text-xs font-medium text-gray-600 capitalize">
                    {TIPO_OPTS.find(o => o.value === r.tipo_problema)?.label ?? r.tipo_problema}
                  </span>
                </div>
                <p className="text-sm text-gray-800 mb-1">{r.descripcion}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                  {r.tecnico_nombre && <span>Técnico: {r.tecnico_nombre}</span>}
                  {r.costo_estimado && <span>S/ {parseFloat(r.costo_estimado).toFixed(2)} est.</span>}
                  <span>{fmtDate(r.created_at)}</span>
                </div>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[r.estado] ?? ''}`}>
                {r.estado}
              </span>
            </div>

            {r.estado !== 'resuelto' && r.estado !== 'cancelado' && (
              <div className="px-4 pb-3 flex gap-2 flex-wrap">
                {r.estado === 'pendiente' && (
                  <button
                    onClick={() => updateMut.mutate({ id: r.id, estado: 'en_proceso' })}
                    disabled={updateMut.isPending}
                    className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Iniciar
                  </button>
                )}
                <button
                  onClick={() => setClosingId(r.id)}
                  disabled={updateMut.isPending}
                  className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Cerrar orden
                </button>
                <button
                  onClick={() => updateMut.mutate({ id: r.id, estado: 'cancelado' })}
                  disabled={updateMut.isPending}
                  className="px-3 py-1 text-xs font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            )}

            {closingId === r.id && (
              <div className="px-4 pb-3 space-y-2 border-t border-gray-100 pt-3">
                <textarea
                  value={notasCierre}
                  onChange={e => setNotasCierre(e.target.value)}
                  placeholder="Notas de cierre (opcional)"
                  rows={2}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <div className="flex gap-2">
                  <button onClick={() => { setClosingId(null); setNotasCierre('') }}
                    className="px-3 py-1 text-xs border border-gray-300 rounded-lg text-gray-600">
                    Cancelar
                  </button>
                  <button
                    onClick={() => updateMut.mutate({ id: r.id, estado: 'resuelto', notas_cierre: notasCierre || undefined })}
                    disabled={updateMut.isPending}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    Confirmar cierre
                  </button>
                </div>
              </div>
            )}

            {r.estado === 'resuelto' && r.notas_cierre && (
              <div className="px-4 pb-3 border-t border-gray-100 pt-2">
                <p className="text-xs text-gray-500 italic">Cierre: {r.notas_cierre}</p>
                {r.fecha_fin && <p className="text-xs text-gray-400">{fmtDate(r.fecha_fin)}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Historial Tab ────────────────────────────────────────────────────────────

function TabHistorial({ room }: { room: Habitacion }) {
  const { data, isLoading } = useQuery<{ ok: boolean; data: MReg[] }>({
    queryKey: ['mantenimiento-historial', room.id],
    queryFn: () => api.get(`/api/v1/habitaciones/${room.id}/mantenimiento`).then(r => r.data as { ok: boolean; data: MReg[] }),
  })

  const resueltos = (data?.data ?? []).filter(r => r.estado === 'resuelto' || r.estado === 'cancelado')

  return (
    <div className="p-5 space-y-3">
      {isLoading && <p className="text-sm text-gray-400">Cargando...</p>}
      {!isLoading && resueltos.length === 0 && (
        <p className="text-sm text-gray-400 text-center pt-8">Sin historial de órdenes cerradas</p>
      )}
      {resueltos.map(r => (
        <div key={r.id} className="border border-gray-100 rounded-xl px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[r.estado] ?? ''}`}>
              {r.estado}
            </span>
            <span className="text-xs text-gray-500 capitalize">
              {TIPO_OPTS.find(o => o.value === r.tipo_problema)?.label ?? r.tipo_problema}
            </span>
            <span className={`ml-auto px-1.5 py-0.5 rounded text-xs border ${PRIORIDAD_BADGE[r.prioridad] ?? ''}`}>
              {r.prioridad}
            </span>
          </div>
          <p className="text-sm text-gray-700">{r.descripcion}</p>
          {r.notas_cierre && <p className="text-xs text-gray-500 italic">{r.notas_cierre}</p>}
          <div className="flex gap-3 text-xs text-gray-400">
            <span>Inicio: {fmtDate(r.created_at)}</span>
            {r.fecha_fin && <span>Fin: {fmtDate(r.fecha_fin)}</span>}
            {r.costo_estimado && <span>S/ {parseFloat(r.costo_estimado).toFixed(2)}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export default function HabitacionDrawer({ room, onClose, onEstadoChanged }: Props) {
  const [tab, setTab] = useState<Tab>('info')

  if (!room) return null

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'mantenimiento', label: 'Mantenimiento' },
    { key: 'historial', label: 'Historial' },
  ]

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Hab. {room.numero}</h2>
            <p className="text-sm text-gray-500">{room.tipo} · Piso {room.piso}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none mt-0.5">&times;</button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 shrink-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === 'info'          && <div className="overflow-y-auto flex-1"><TabInfo room={room} /></div>}
          {tab === 'mantenimiento' && <TabMantenimiento room={room} onEstadoChanged={onEstadoChanged} />}
          {tab === 'historial'     && <div className="overflow-y-auto flex-1"><TabHistorial room={room} /></div>}
        </div>
      </div>
    </div>
  )
}
