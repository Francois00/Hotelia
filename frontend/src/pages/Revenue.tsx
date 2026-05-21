import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, startOfMonth } from 'date-fns'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from 'recharts'
import api from '../api/client'
import ia from '../api/ia'

interface KPIs {
  ingresos_totales: number
  ocupacion_pct: number
  adr: number
  revpar: number
  comparativa_mes_anterior?: {
    ingresos_delta: number
    ocupacion_delta: number
    revpar_delta: number
  }
}

interface ForecastItem {
  fecha: string
  ocupacion_predicha: number
  intervalo_inferior: number
  intervalo_superior: number
  alerta?: boolean
}

interface Forecast { predicciones: ForecastItem[] }

interface PricingFactores {
  ocupacion_factor: number
  lead_time_factor: number
  seasonality_factor: number
  canal_factor: number
  multiplicador_total: number
}

interface PricingItem {
  habitacion_id: string
  numero: string
  tipo: string
  tarifa_base: number
  tarifa_recomendada: number
  factores: PricingFactores
}

interface PricingResponse {
  recomendaciones: PricingItem[]
}

interface Reserva {
  canal_origen: string
  tarifa_acordada: number
}

interface ReservasResponse {
  data: Reserva[]
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)

const CANAL_COLORS: Record<string, string> = {
  DIRECTO: '#3B82F6',
  BOOKING_COM: '#EF4444',
  EXPEDIA: '#F97316',
  AIRBNB: '#EC4899',
  WHATSAPP: '#22C55E',
}

function KpiCard({
  label, value, delta, isPercent = false
}: {
  label: string
  value: string
  delta?: number
  isPercent?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {delta !== undefined && (
        <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}{isPercent ? 'pp' : '%'} vs mes anterior
        </p>
      )}
    </div>
  )
}

function FactorBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(Math.abs(value - 1) * 200, 100)
  const positive = value >= 1
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 text-gray-500 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${positive ? 'bg-green-500' : 'bg-red-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-12 text-right font-mono font-medium ${positive ? 'text-green-700' : 'text-red-600'}`}>
        {(value ?? 0).toFixed(2)}x
      </span>
    </div>
  )
}

export default function Revenue() {
  const defaultDesde = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const defaultHasta = format(new Date(), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')

  const [desde, setDesde] = useState(defaultDesde)
  const [hasta, setHasta] = useState(defaultHasta)
  const [expandedPricing, setExpandedPricing] = useState<string | null>(null)

  const { data: kpis, isLoading: kpisLoading } = useQuery<KPIs>({
    queryKey: ['revenue-kpis', desde, hasta],
    queryFn: () => api.get<KPIs>(`/api/v1/revenue/kpis?desde=${desde}&hasta=${hasta}`).then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: forecast } = useQuery<Forecast>({
    queryKey: ['forecast-90'],
    queryFn: () => api.get<Forecast>('/api/v1/revenue/forecast?dias=90').then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: reservasData } = useQuery<ReservasResponse>({
    queryKey: ['reservas-canal'],
    queryFn: () => api.get<ReservasResponse>('/api/v1/reservas?limit=200').then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: habitacionesData } = useQuery<{ id: string; numero: string; tipo: string; tarifa_base: number }[]>({
    queryKey: ['habitaciones-pricing'],
    queryFn: () => api.get<{ data: { id: string; numero: string; tipo: string; tarifa_base: number }[] }>('/api/v1/habitaciones?limit=200').then(r => r.data.data),
  })

  const { data: pricingData } = useQuery<PricingResponse>({
    queryKey: ['pricing-batch', habitacionesData?.length],
    queryFn: async () => {
      if (!habitacionesData?.length) return { recomendaciones: [] }
      return ia.post<PricingResponse>('/ia/v1/pricing/batch', {
        habitaciones: habitacionesData.map(r => ({
          habitacion_id: r.id,
          fecha_entrada: today,
          fecha_salida: tomorrow,
          canal: 'DIRECTO',
        })),
      }).then(r => r.data)
    },
    enabled: !!habitacionesData?.length,
    retry: false,
  })

  const canalBreakdown = useMemo(() => {
    if (!reservasData?.data) return []
    const map: Record<string, number> = {}
    for (const r of reservasData.data) {
      map[r.canal_origen] = (map[r.canal_origen] ?? 0) + r.tarifa_acordada
    }
    return Object.entries(map)
      .map(([canal, total]) => ({ canal, total }))
      .sort((a, b) => b.total - a.total)
  }, [reservasData])

  const forecastData = forecast?.predicciones ?? []

  const forecastFiltered = forecastData.filter((_, i) => i % 7 === 0 || i === forecastData.length - 1)

  const kpiDelta = (key: 'ingresos' | 'revpar') => {
    if (!kpis?.comparativa_mes_anterior) return undefined
    return key === 'ingresos'
      ? kpis.comparativa_mes_anterior.ingresos_delta
      : kpis.comparativa_mes_anterior.revpar_delta
  }

  const recomendaciones = pricingData?.recomendaciones ?? []

  if (kpisLoading) return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="text-white">Cargando métricas...</div>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue & Pricing</h1>
          <p className="text-gray-500 text-sm mt-0.5">Análisis de ingresos y tarifas dinámicas</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Período:</span>
          <input
            type="date"
            value={desde}
            onChange={e => setDesde(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="date"
            value={hasta}
            onChange={e => setHasta(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Revenue Total"
          value={kpis ? formatCurrency(kpis.ingresos_totales) : '—'}
          delta={kpiDelta('ingresos')}
        />
        <KpiCard
          label="Ocupación"
          value={kpis ? `${(kpis.ocupacion_pct ?? 0).toFixed(1)}%` : '—'}
          delta={kpis?.comparativa_mes_anterior?.ocupacion_delta}
          isPercent
        />
        <KpiCard
          label="ADR"
          value={kpis ? formatCurrency(kpis.adr) : '—'}
        />
        <KpiCard
          label="RevPAR"
          value={kpis ? formatCurrency(kpis.revpar) : '—'}
          delta={kpiDelta('revpar')}
        />
      </div>

      {/* Forecast chart */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Forecast de Ocupación (90 días)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={forecastData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="fecha"
              ticks={forecastFiltered.map(d => d.fecha)}
              tickFormatter={d => format(parseISO(d), 'dd/MM')}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={v => `${v}%`}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
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
              labelFormatter={l => format(parseISO(String(l)), 'dd MMM yyyy')}
            />
            <ReferenceLine y={40} stroke="#EF4444" strokeDasharray="4 2" label={{ value: 'Baja', fontSize: 10, fill: '#EF4444' }} />
            <ReferenceLine y={85} stroke="#22C55E" strokeDasharray="4 2" label={{ value: 'Alta demanda', fontSize: 10, fill: '#22C55E' }} />
            <Area type="monotone" dataKey="intervalo_superior" fill="#3B82F6" fillOpacity={0.1} stroke="none" />
            <Area type="monotone" dataKey="intervalo_inferior" fill="white" fillOpacity={1} stroke="none" />
            <Line
              type="monotone"
              dataKey="ocupacion_predicha"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props as { cx: number; cy: number; payload: ForecastItem }
                if (!payload.alerta) return <g key={`dot-${payload.fecha}`} />
                return (
                  <circle
                    key={`dot-${payload.fecha}`}
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill="#EF4444"
                    stroke="white"
                    strokeWidth={2}
                  />
                )
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Pricing table + Canal chart */}
      <div className="grid grid-cols-3 gap-4">
        {/* Pricing table */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Tarifas Recomendadas por IA</h2>
            {!recomendaciones.length && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">IA no disponible</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Habitación', 'Tipo', 'Base', 'Recomendada', 'Variación'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recomendaciones.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                      {pricingData ? 'Sin datos de pricing' : 'Cargando recomendaciones...'}
                    </td>
                  </tr>
                )}
                {recomendaciones.map(r => {
                  const variacion = r.tarifa_base ? ((r.tarifa_recomendada - r.tarifa_base) / r.tarifa_base * 100) : 0
                  const isExpanded = expandedPricing === r.habitacion_id
                  return (
                    <>
                      <tr
                        key={r.habitacion_id}
                        onClick={() => setExpandedPricing(isExpanded ? null : r.habitacion_id)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-gray-900">Hab. {r.numero}</td>
                        <td className="px-4 py-3 text-gray-600">{r.tipo}</td>
                        <td className="px-4 py-3 text-gray-600">{formatCurrency(r.tarifa_base)}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(r.tarifa_recomendada)}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold text-sm ${variacion >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {variacion >= 0 ? '+' : ''}{variacion.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${r.habitacion_id}-expanded`}>
                          <td colSpan={5} className="px-4 py-4 bg-gray-50 border-b border-gray-200">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-gray-600 mb-3">Factores de ajuste</p>
                              <FactorBar label="Ocupación" value={r.factores.ocupacion_factor} />
                              <FactorBar label="Lead time" value={r.factores.lead_time_factor} />
                              <FactorBar label="Estacionalidad" value={r.factores.seasonality_factor} />
                              <FactorBar label="Canal" value={r.factores.canal_factor} />
                              <div className="pt-2 border-t border-gray-200">
                                <FactorBar label="Multiplicador total" value={r.factores.multiplicador_total} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Canal breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Revenue por Canal</h2>
          {canalBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={canalBreakdown}
                layout="vertical"
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="canal" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Revenue']} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {canalBreakdown.map(entry => (
                    <Cell key={entry.canal} fill={CANAL_COLORS[entry.canal] ?? '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          <div className="mt-4 space-y-2">
            {canalBreakdown.map(entry => (
              <div key={entry.canal} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: CANAL_COLORS[entry.canal] ?? '#6b7280' }} />
                  <span className="text-gray-600">{entry.canal}</span>
                </div>
                <span className="font-semibold text-gray-900">{formatCurrency(entry.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
