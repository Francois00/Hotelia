import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import api from '../api/client'
import ia from '../api/ia'

interface Huesped {
  id: string
  nombre: string
  email: string
  telefono?: string
  nacionalidad?: string
  fecha_nacimiento?: string
  documento_tipo?: string
  documento_numero?: string
  idioma_preferido?: string
  segmento_crm?: string
  notas_internas?: string
}

interface HistorialRaw {
  id: string
  codigo_reserva: string
  habitacion: { numero: string; tipo: string }
  fecha_entrada: string
  fecha_salida: string
  num_noches: number
  tarifa_acordada: number
  estado: string
  metodo_pago?: string
}

interface HistorialResp {
  total_estancias: number
  gasto_total: number
  ultima_visita?: string
  reservas: HistorialRaw[]
}

interface LTVData {
  historico: number
  proyectado: number
  ltv_calculado?: number
}

interface Props {
  huesped: Huesped
  onClose: () => void
}

type Tab = 'resumen' | 'historial' | 'notas'

const SEGMENT_CONFIG: Record<string, { icon: string; cls: string }> = {
  VIP:        { icon: '⭐', cls: 'bg-amber-100 text-amber-700' },
  RECURRENTE: { icon: '🔄', cls: 'bg-blue-100 text-blue-700' },
  OCASIONAL:  { icon: '',   cls: 'bg-purple-100 text-purple-700' },
  NUEVO:      { icon: '',   cls: 'bg-green-100 text-green-700' },
  INACTIVO:   { icon: '',   cls: 'bg-gray-100 text-gray-500' },
}

const estadoBadgeCls: Record<string, string> = {
  CONFIRMADA:        'bg-blue-100 text-blue-700',
  CHECKIN_REALIZADO: 'bg-green-100 text-green-700',
  CHECKOUT_REALIZADO:'bg-gray-100 text-gray-600',
  CANCELADA:         'bg-red-100 text-red-700',
  NO_SHOW:           'bg-orange-100 text-orange-700',
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)

function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(name: string) {
  const colors = ['#3B82F6', '#EF4444', '#22C55E', '#EAB308', '#8B5CF6', '#EC4899', '#14B8A6']
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

function getSegmento(huesped: Huesped, historial: HistorialResp | null): string {
  if (huesped.segmento_crm) return huesped.segmento_crm
  const visitas = historial?.total_estancias ?? 0
  const gasto   = historial?.gasto_total ?? 0
  if (visitas >= 5 && gasto >= 300) return 'VIP'
  if (visitas >= 3) return 'RECURRENTE'
  if (visitas === 2) return 'OCASIONAL'
  return 'NUEVO'
}

export default function HuespedDrawer({ huesped, onClose }: Props) {
  const [tab, setTab]             = useState<Tab>('resumen')
  const [historial, setHistorial] = useState<HistorialResp | null>(null)
  const [ltv, setLtv]             = useState<LTVData | null>(null)
  const [loadingH, setLoadingH]   = useState(true)
  const [nota, setNota]           = useState('')
  const [notas, setNotas]         = useState<{ texto: string; fecha: string }[]>([])

  useEffect(() => {
    setLoadingH(true)
    api
      .get<HistorialResp>(`/api/v1/huespedes/${huesped.id}/historial`)
      .then(r => setHistorial(r.data))
      .catch(() => setHistorial(null))
      .finally(() => setLoadingH(false))

    ia.get<LTVData>(`/ia/v1/crm/huespedes/${huesped.id}/ltv`)
      .then(r => setLtv(r.data))
      .catch(() => {})
  }, [huesped.id])

  const segmento   = getSegmento(huesped, historial)
  const segCfg     = SEGMENT_CONFIG[segmento] ?? { icon: '', cls: 'bg-gray-100 text-gray-600' }
  const reservas   = historial?.reservas ?? []
  const sorted     = [...reservas].sort(
    (a, b) => new Date(b.fecha_entrada).getTime() - new Date(a.fecha_entrada).getTime(),
  )

  const handleAddNota = () => {
    if (!nota.trim()) return
    setNotas(prev => [{ texto: nota.trim(), fecha: new Date().toISOString() }, ...prev])
    setNota('')
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex items-center gap-4 shrink-0">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ background: getAvatarColor(huesped.nombre) }}
          >
            {getInitials(huesped.nombre)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-gray-900 truncate">{huesped.nombre}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${segCfg.cls}`}>
                {segCfg.icon} {segmento}
              </span>
            </div>
            {(huesped.documento_tipo || huesped.documento_numero) && (
              <p className="text-xs text-gray-500 mt-0.5">
                {huesped.documento_tipo} {huesped.documento_numero}
              </p>
            )}
            <p className="text-xs text-gray-400">{huesped.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none shrink-0"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 shrink-0 bg-white">
          {([
            ['resumen',   'Resumen'],
            ['historial', 'Historial'],
            ['notas',     'Notas'],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Tab: Resumen ── */}
          {tab === 'resumen' && (
            <div className="p-6 space-y-4">
              {loadingH ? (
                <div className="flex items-center justify-center py-12">
                  <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard
                      label="Total visitas"
                      value={String(historial?.total_estancias ?? 0)}
                    />
                    <StatCard
                      label="Total gastado"
                      value={formatCurrency(historial?.gasto_total ?? 0)}
                    />
                    <StatCard
                      label="Promedio / estancia"
                      value={
                        historial && historial.total_estancias > 0
                          ? formatCurrency(historial.gasto_total / historial.total_estancias)
                          : '—'
                      }
                    />
                    <StatCard
                      label="Última visita"
                      value={
                        historial?.ultima_visita
                          ? format(parseISO(historial.ultima_visita), 'dd/MM/yyyy')
                          : sorted[0]?.fecha_salida
                            ? format(parseISO(sorted[0].fecha_salida), 'dd/MM/yyyy')
                            : 'Sin registros'
                      }
                    />
                  </div>
                  {ltv && (
                    <div className="bg-blue-50 rounded-xl p-4 space-y-1">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Lifetime Value</p>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Histórico</p>
                          <p className="font-bold text-blue-700">{formatCurrency(ltv.historico)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Proyectado</p>
                          <p className="font-bold text-blue-400">{formatCurrency(ltv.proyectado)}</p>
                        </div>
                        {ltv.ltv_calculado != null && (
                          <div>
                            <p className="text-xs text-gray-500">LTV calculado</p>
                            <p className="font-bold text-green-600">{formatCurrency(ltv.ltv_calculado)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {huesped.notas_internas && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-gray-700">
                      <p className="text-xs font-semibold text-yellow-700 mb-1">Notas internas</p>
                      {huesped.notas_internas}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Tab: Historial ── */}
          {tab === 'historial' && (
            <div className="p-6">
              {loadingH ? (
                <div className="flex items-center justify-center py-12">
                  <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sorted.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">Sin estancias registradas</p>
              ) : (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Entrada', 'Salida', 'Hab.', 'Noches', 'Total', 'Estado'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sorted.map(r => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                              {format(parseISO(r.fecha_entrada), 'dd/MM/yy')}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                              {format(parseISO(r.fecha_salida), 'dd/MM/yy')}
                            </td>
                            <td className="px-3 py-2 text-gray-700 font-medium">{r.habitacion.numero}</td>
                            <td className="px-3 py-2 text-center text-gray-600">{r.num_noches}</td>
                            <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                              {formatCurrency(r.tarifa_acordada)}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                estadoBadgeCls[r.estado] ?? 'bg-gray-100 text-gray-600'
                              }`}>
                                {r.estado.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Notas ── */}
          {tab === 'notas' && (
            <div className="p-6 space-y-4">
              {/* Form nueva nota */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-600">Agregar nota del personal</label>
                <textarea
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  rows={3}
                  placeholder="Escribe una nota sobre este huésped..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <button
                  onClick={handleAddNota}
                  disabled={!nota.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Agregar nota
                </button>
              </div>

              {/* Lista de notas */}
              {notas.length === 0 && !huesped.notas_internas ? (
                <p className="text-center text-gray-400 py-6 text-sm">
                  No hay notas registradas para este huésped
                </p>
              ) : (
                <div className="space-y-3">
                  {huesped.notas_internas && (
                    <NoteCard texto={huesped.notas_internas} fecha="" autor="Sistema" />
                  )}
                  {notas.map((n, i) => (
                    <NoteCard key={i} texto={n.texto} fecha={n.fecha} autor="Recepción" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-base font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  )
}

function NoteCard({ texto, fecha, autor }: { texto: string; fecha: string; autor: string }) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-yellow-700">{autor}</span>
        {fecha && (
          <span className="text-xs text-gray-400">
            {format(parseISO(fecha), 'dd/MM/yy HH:mm')}
          </span>
        )}
      </div>
      <p className="text-gray-700">{texto}</p>
    </div>
  )
}
