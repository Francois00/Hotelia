import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
} from 'recharts'
import api from '../api/client'
import ia from '../api/ia'

interface SegmentoResumen {
  segmento: string
  count: number
}

interface VIPEntry {
  id: string
  nombre: string
  email?: string
  ltv: number
  ultima_estancia?: string
  proxima_visita?: string
  segmento: string
}

interface CRMStats {
  resumen: SegmentoResumen[]
  inactivos_para_reactivar: number
  top_10_vip: VIPEntry[]
}

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
  preferencias?: Record<string, string>
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
}

interface HistorialResp {
  huesped: unknown
  total_estancias: number
  gasto_total: number
  reservas: HistorialRaw[]
}

interface LTVData {
  historico: number
  proyectado: number
}

const SEGMENT_COLORS: Record<string, string> = {
  VIP: '#F59E0B',
  RECURRENTE: '#3B82F6',
  OCASIONAL: '#8B5CF6',
  INACTIVO: '#6B7280',
  NUEVO: '#22C55E',
}

const estadoBadgeClass: Record<string, string> = {
  CONFIRMADA: 'bg-blue-100 text-blue-700',
  CHECKIN_REALIZADO: 'bg-green-100 text-green-700',
  CHECKOUT_REALIZADO: 'bg-gray-100 text-gray-600',
  CANCELADA: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-orange-100 text-orange-700',
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)

const getAvatarColor = (name: string) => {
  const colors = ['#3B82F6', '#EF4444', '#22C55E', '#EAB308', '#8B5CF6', '#EC4899', '#14B8A6']
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

const getInitials = (name: string) => {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, background: getAvatarColor(name), fontSize: size * 0.35 }}
    >
      {getInitials(name)}
    </div>
  )
}

function SegmentBadge({ segmento }: { segmento: string }) {
  const color = SEGMENT_COLORS[segmento] ?? '#6B7280'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
      style={{ background: color }}
    >
      {segmento}
    </span>
  )
}

function GuestProfile({ huesped, onClose }: { huesped: Huesped; onClose: () => void }) {
  const navigate = useNavigate()
  const [ltv, setLtv] = useState<LTVData | null>(null)
  const [historial, setHistorial] = useState<HistorialRaw[]>([])
  const [segmentando, setSegmentando] = useState(false)

  useEffect(() => {
    ia.get<LTVData>(`/ia/v1/crm/huespedes/${huesped.id}/ltv`)
      .then(r => setLtv(r.data)).catch(() => {})
    api.get<HistorialResp>(`/api/v1/huespedes/${huesped.id}/historial`)
      .then(r => setHistorial(r.data.reservas ?? [])).catch(() => {})
  }, [huesped.id])

  const handleRecalcular = async () => {
    setSegmentando(true)
    try {
      await ia.post('/ia/v1/crm/segmentar-todos')
    } catch { /* silent */ } finally { setSegmentando(false) }
  }

  const ltvChartData = ltv
    ? [{ name: 'Histórico', value: ltv.historico }, { name: 'Proyectado', value: ltv.proyectado }]
    : []

  const languageFlags: Record<string, string> = { es: '🇪🇸', en: '🇺🇸', pt: '🇧🇷', fr: '🇫🇷', de: '🇩🇪', zh: '🇨🇳', ja: '🇯🇵' }
  const flag = languageFlags[huesped.idioma_preferido ?? ''] ?? '🌐'

  return (
    <div className="mt-5 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-4">
        <Avatar name={huesped.nombre} size={56} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-gray-900 truncate">{huesped.nombre}</h3>
            <span className="text-lg" title={huesped.idioma_preferido}>{flag}</span>
            {huesped.segmento_crm && <SegmentBadge segmento={huesped.segmento_crm} />}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{huesped.email}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none shrink-0">&times;</button>
      </div>

      <div className="p-6">
        {/* 3-column info grid */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contacto</h4>
            <InfoRow label="Email" value={huesped.email} />
            <InfoRow label="Teléfono" value={huesped.telefono} />
            <InfoRow label="Nacionalidad" value={huesped.nacionalidad} />
            <InfoRow label="Nacimiento" value={huesped.fecha_nacimiento ? format(parseISO(huesped.fecha_nacimiento), 'dd/MM/yyyy') : undefined} />
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Identificación</h4>
            <InfoRow label="Tipo doc." value={huesped.documento_tipo} />
            <InfoRow label="Número" value={huesped.documento_numero} />
            <InfoRow label="Idioma" value={huesped.idioma_preferido?.toUpperCase()} />
            {huesped.notas_internas && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Notas internas</p>
                <p className="text-sm text-gray-700 bg-yellow-50 rounded p-2">{huesped.notas_internas}</p>
              </div>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Lifetime Value</h4>
            {ltv ? (
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Histórico: <strong className="text-blue-700">{formatCurrency(ltv.historico)}</strong></span>
                  <span>Proyectado: <strong className="text-blue-400">{formatCurrency(ltv.proyectado)}</strong></span>
                </div>
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={ltvChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `S/${(Number(v) / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      <Cell fill="#3B82F6" />
                      <Cell fill="#93C5FD" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-gray-400">LTV no disponible</p>
            )}
          </div>
        </div>

        {/* Historial table */}
        {historial.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Historial de estancias</h4>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {['Código', 'Hab.', 'Entrada', 'Salida', 'Noches', 'Total', 'Estado'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historial.map(h => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{h.codigo_reserva}</td>
                        <td className="px-3 py-2 text-gray-700">{h.habitacion.numero}</td>
                        <td className="px-3 py-2 text-gray-600">{format(parseISO(h.fecha_entrada), 'dd/MM/yy')}</td>
                        <td className="px-3 py-2 text-gray-600">{format(parseISO(h.fecha_salida), 'dd/MM/yy')}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{h.num_noches}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{formatCurrency(h.tarifa_acordada)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${estadoBadgeClass[h.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                            {h.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => void handleRecalcular()}
            disabled={segmentando}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            {segmentando && <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />}
            Recalcular LTV
          </button>
          <button
            onClick={() => navigate(`/reservas?huesped_id=${huesped.id}`)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Ver reservas →
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-700 font-medium">{value}</p>
    </div>
  )
}

export default function CRM() {
  const [huespedSearch, setHuespedSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Huesped[]>([])
  const [selectedHuesped, setSelectedHuesped] = useState<Huesped | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: stats, isLoading: statsLoading } = useQuery<CRMStats>({
    queryKey: ['crm-stats'],
    queryFn: () => ia.get<CRMStats>('/ia/v1/crm/stats').then(r => r.data),
    retry: false,
    refetchInterval: 60000,
  })

  const doSearch = useCallback((q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return }
    searchTimer.current = setTimeout(() => {
      api.get<Huesped[]>(`/api/v1/huespedes?nombre=${encodeURIComponent(q)}&limit=10`)
        .then(r => { setSearchResults((r.data as unknown as { data: Huesped[] }).data ?? []); setShowDropdown(true) })
        .catch(() => {})
    }, 300)
  }, [])

  useEffect(() => { doSearch(huespedSearch) }, [huespedSearch, doSearch])

  const totalCount = stats?.resumen.reduce((acc, r) => acc + r.count, 0) ?? 0
  const vipCount = stats?.resumen.find(r => r.segmento === 'VIP')?.count ?? 0

  const pieData = stats?.resumen.map(r => ({ name: r.segmento, value: r.count })) ?? []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gestión de relación con huéspedes</p>
      </div>

      {/* Section 1 — Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-lg">👥</div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total huéspedes</p>
            <p className="text-2xl font-bold text-gray-900">{statsLoading ? '—' : totalCount.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-lg">⭐</div>
          <div>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Huéspedes VIP</p>
            <p className="text-2xl font-bold text-amber-600">{statsLoading ? '—' : vipCount.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg">💤</div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Inactivos a reactivar</p>
            <p className="text-2xl font-bold text-gray-600">{statsLoading ? '—' : (stats?.inactivos_para_reactivar ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Section 2 — Donut + VIP table */}
      <div className="grid grid-cols-2 gap-4">
        {/* Donut chart */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Distribución por segmento</h2>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {pieData.map(entry => (
                    <Cell key={entry.name} fill={SEGMENT_COLORS[entry.name] ?? '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${Number(value)} huéspedes`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{totalCount.toLocaleString()}</p>
                <p className="text-xs text-gray-500">huéspedes</p>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {pieData.map(entry => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: SEGMENT_COLORS[entry.name] ?? '#6B7280' }} />
                  <span className="text-gray-700 font-medium">{entry.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{entry.value.toLocaleString()}</span>
                  <span className="text-gray-400 text-xs w-10 text-right">
                    {totalCount > 0 ? `${((entry.value / totalCount) * 100).toFixed(1)}%` : '0%'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VIP table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Top VIPs</h2>
            <span>👑</span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                <tr>
                  {['Huésped', 'LTV', 'Última', 'Próxima', 'Seg.'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!stats?.top_10_vip?.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Sin datos VIP</td>
                  </tr>
                )}
                {stats?.top_10_vip?.map(v => (
                  <tr key={v.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={v.nombre} size={28} />
                        <span className="font-medium text-gray-900 truncate max-w-28">{v.nombre}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-amber-600">{formatCurrency(v.ltv)}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">
                      {v.ultima_estancia ? format(parseISO(v.ultima_estancia), 'dd/MM/yy') : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">
                      {v.proxima_visita ? format(parseISO(v.proxima_visita), 'dd/MM/yy') : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <SegmentBadge segmento={v.segmento} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 3 — Guest search */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Buscar huésped</h2>
        <div className="relative">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={huespedSearch}
              onChange={e => { setHuespedSearch(e.target.value); setSelectedHuesped(null) }}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Nombre, email o documento..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {searchResults.map(h => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setSelectedHuesped(h)
                    setHuespedSearch(h.nombre)
                    setShowDropdown(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-left"
                >
                  <Avatar name={h.nombre} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{h.nombre}</p>
                    <p className="text-xs text-gray-500 truncate">{h.email}</p>
                  </div>
                  {h.segmento_crm && <SegmentBadge segmento={h.segmento_crm} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedHuesped && (
          <GuestProfile
            huesped={selectedHuesped}
            onClose={() => { setSelectedHuesped(null); setHuespedSearch('') }}
          />
        )}
      </div>
    </div>
  )
}
