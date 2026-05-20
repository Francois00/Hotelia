import { useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import HuespedDrawer from '../components/HuespedDrawer'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import api from '../api/client'

interface Huesped {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono?: string
  nacionalidad?: string
  fecha_nacimiento?: string
  documento_tipo?: string
  documento_numero?: string
  idioma_preferido?: string
  segmento_crm?: string
  ltv_calculado?: number
  notas_internas?: string
  preferencias?: Record<string, string>
  total_estancias?: number
  activo?: boolean
}

const SEGMENT_COLORS: Record<string, string> = {
  VIP:         '#F59E0B',
  RECURRENTE:  '#3B82F6',
  CORPORATIVO: '#0EA5E9',
  OCASIONAL:   '#8B5CF6',
  NORMAL:      '#64748B',
  INACTIVO:    '#6B7280',
  NUEVO:       '#22C55E',
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

const getInitials = (nombre: string, apellido?: string) => {
  const n = nombre?.trim() ?? ''
  const a = apellido?.trim() ?? ''
  if (n && a) return `${n[0]}${a[0]}`.toUpperCase()
  if (n) return n.slice(0, 2).toUpperCase()
  return '??'
}

function Avatar({ nombre, apellido, size = 36 }: { nombre: string; apellido?: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, background: getAvatarColor(nombre), fontSize: size * 0.35 }}
    >
      {getInitials(nombre, apellido)}
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

export default function CRM() {
  const [huespedSearch, setHuespedSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Huesped[]>([])
  const [selectedHuesped, setSelectedHuesped] = useState<Huesped | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load all guests — limit 300 (backend max)
  const { data: allHuespedesResp, isLoading: allLoading } = useQuery<{ data: Huesped[]; meta: { total: number } }>({
    queryKey: ['crm-all-huespedes'],
    queryFn: () => api.get('/api/v1/huespedes?limit=300').then(r => r.data as { data: Huesped[]; meta: { total: number } }),
    staleTime: 30000,
  })

  const allHuespedes = allHuespedesResp?.data ?? []

  // ── KPIs calculados directamente del array cargado ──────────────────────────
  const totalHuespedes   = allHuespedes.length
  const totalVip         = allHuespedes.filter(h => h.segmento_crm === 'VIP').length
  const totalRecurrentes = allHuespedes.filter(h => h.segmento_crm === 'RECURRENTE').length
  const totalInactivos   = allHuespedes.filter(h => h.segmento_crm === 'INACTIVO').length

  const topVips = [...allHuespedes]
    .filter(h => (h.segmento_crm === 'VIP' || h.segmento_crm === 'CORPORATIVO'))
    .sort((a, b) => (b.ltv_calculado ?? 0) - (a.ltv_calculado ?? 0))
    .slice(0, 10)

  const distribucion = Object.entries(
    allHuespedes.reduce<Record<string, number>>((acc, h) => {
      const seg = h.segmento_crm ?? 'NUEVO'
      acc[seg] = (acc[seg] ?? 0) + 1
      return acc
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
  // ──────────────────────────────────────────────────────────────────────────────

  const doSearch = useCallback((q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); setSearching(false); setSearched(false); return }
    setSearching(true)
    searchTimer.current = setTimeout(() => {
      api.get<{ data: Huesped[] }>(`/api/v1/huespedes?nombre=${encodeURIComponent(q)}&limit=10`)
        .then(r => {
          setSearchResults(r.data.data ?? [])
          setShowDropdown(true)
          setSearched(true)
        })
        .catch(() => { setSearchResults([]); setSearched(true) })
        .finally(() => setSearching(false))
    }, 400)
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gestión de relación con huéspedes</p>
      </div>

      {/* Section 1 — KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-lg">👥</div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total huéspedes</p>
            <p className="text-2xl font-bold text-gray-900">{allLoading ? '—' : totalHuespedes.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-lg">⭐</div>
          <div>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">VIP</p>
            <p className="text-2xl font-bold text-amber-600">{allLoading ? '—' : totalVip.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-lg">🔄</div>
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Recurrentes</p>
            <p className="text-2xl font-bold text-blue-600">{allLoading ? '—' : totalRecurrentes.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg">💤</div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Inactivos</p>
            <p className="text-2xl font-bold text-gray-600">{allLoading ? '—' : totalInactivos.toLocaleString()}</p>
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
                  data={distribucion}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {distribucion.map(entry => (
                    <Cell key={entry.name} fill={SEGMENT_COLORS[entry.name] ?? '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${Number(value)} huéspedes`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{totalHuespedes.toLocaleString()}</p>
                <p className="text-xs text-gray-500">huéspedes</p>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {distribucion.map(entry => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: SEGMENT_COLORS[entry.name] ?? '#6B7280' }} />
                  <span className="text-gray-700 font-medium">{entry.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{entry.value.toLocaleString()}</span>
                  <span className="text-gray-400 text-xs w-10 text-right">
                    {totalHuespedes > 0 ? `${((entry.value / totalHuespedes) * 100).toFixed(1)}%` : '0%'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VIP + CORPORATIVO table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Top Huéspedes</h2>
            <span>👑</span>
            <span className="ml-auto text-xs text-gray-400">por LTV</span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                <tr>
                  {['Huésped', 'LTV', 'Estadías', 'Segmento'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allLoading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">Cargando...</td>
                  </tr>
                )}
                {!allLoading && topVips.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">Sin huéspedes VIP</td>
                  </tr>
                )}
                {topVips.map(h => (
                  <tr key={h.id}
                    className="hover:bg-amber-50/40 transition-colors cursor-pointer"
                    onClick={() => { setSelectedHuesped(h); setHuespedSearch(`${h.nombre} ${h.apellido}`) }}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar nombre={h.nombre} apellido={h.apellido} size={28} />
                        <span className="font-medium text-gray-900 truncate max-w-28">
                          {h.apellido ? `${h.apellido}, ${h.nombre}` : h.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-amber-600">
                      {h.ltv_calculado != null ? formatCurrency(h.ltv_calculado) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">
                      {h.total_estancias ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {h.segmento_crm ? <SegmentBadge segmento={h.segmento_crm} /> : <span className="text-gray-400">—</span>}
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
              onChange={e => { setHuespedSearch(e.target.value); setSelectedHuesped(null); doSearch(e.target.value) }}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Nombre, email o documento..."
              className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {searchResults.map(h => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setSelectedHuesped(h)
                    setHuespedSearch(`${h.nombre} ${h.apellido ?? ''}`.trim())
                    setShowDropdown(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-left"
                >
                  <Avatar nombre={h.nombre} apellido={h.apellido} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {h.apellido ? `${h.apellido}, ${h.nombre}` : h.nombre}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{h.email}</p>
                  </div>
                  {h.segmento_crm && <SegmentBadge segmento={h.segmento_crm} />}
                </button>
              ))}
            </div>
          )}

          {!searching && searched && huespedSearch.trim() && searchResults.length === 0 && (
            <p className="mt-2 text-sm text-gray-400 px-1">No se encontraron huéspedes con ese criterio</p>
          )}
        </div>

        {selectedHuesped && (
          <HuespedDrawer
            huesped={selectedHuesped}
            onClose={() => { setSelectedHuesped(null); setHuespedSearch('') }}
          />
        )}
      </div>

      {/* Section 4 — All guests table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Todos los huéspedes</h2>
          <span className="text-xs text-gray-400">
            {allLoading ? 'Cargando...' : `${allHuespedesResp?.meta?.total ?? totalHuespedes} registros`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                {['Huésped', 'Email', 'Teléfono', 'Estancias', 'LTV', 'Segmento'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Cargando huéspedes...</td></tr>
              )}
              {!allLoading && allHuespedes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin huéspedes registrados</td></tr>
              )}
              {allHuespedes.map(h => (
                <tr
                  key={h.id}
                  className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                  onClick={() => { setSelectedHuesped(h); setHuespedSearch(`${h.nombre} ${h.apellido ?? ''}`.trim()) }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar nombre={h.nombre} apellido={h.apellido} size={28} />
                      <span className="font-medium text-gray-900">
                        {h.apellido ? `${h.apellido}, ${h.nombre}` : h.nombre}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{h.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{h.telefono || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-center">{h.total_estancias ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-700">
                    {h.ltv_calculado != null && h.ltv_calculado > 0 ? formatCurrency(h.ltv_calculado) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {h.segmento_crm ? <SegmentBadge segmento={h.segmento_crm} /> : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
