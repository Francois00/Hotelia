import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts'
import api from '../api/client'

interface DiaForecast {
  fecha: string
  ocupacion_estimada_pct: number
  confianza: number
}

interface ProximoEvento {
  descripcion: string
  fecha_evento: string
  impacto_estimado: 'alto' | 'medio' | 'bajo'
}

interface PronosticoResp {
  proximos_30_dias: DiaForecast[]
  tendencia: 'subiendo' | 'bajando' | 'estable'
  factor_temporada: 'alta' | 'media' | 'baja'
  proximo_evento: ProximoEvento | null
  recomendacion: string
  ia_disponible: boolean
}

const TENDENCIA_INFO: Record<PronosticoResp['tendencia'], { icon: string; label: string; color: string }> = {
  subiendo: { icon: '📈', label: 'Subiendo', color: 'text-success' },
  bajando:  { icon: '📉', label: 'Bajando', color: 'text-danger' },
  estable:  { icon: '➡️', label: 'Estable', color: 'text-text-primary' },
}

const IMPACTO_INFO: Record<ProximoEvento['impacto_estimado'], string> = {
  alto: 'text-danger',
  medio: 'text-warning',
  bajo: 'text-text-secondary',
}

export default function GananciaPage() {
  const [data, setData] = useState<PronosticoResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actualizadoEn] = useState(new Date())

  useEffect(() => {
    api.get<PronosticoResp>('/api/v1/empresa/pronostico-ocupacion')
      .then(r => setData(r.data))
      .catch(() => setError('No se pudo cargar el pronóstico de ocupación'))
      .finally(() => setLoading(false))
  }, [])

  const promedio = data && data.proximos_30_dias.length > 0
    ? data.proximos_30_dias.reduce((acc, d) => acc + d.ocupacion_estimada_pct, 0) / data.proximos_30_dias.length
    : null

  const horasDesdeActualizacion = Math.max(0, Math.round((Date.now() - actualizadoEn.getTime()) / 3_600_000))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">📈 Ganancia — Pronóstico de Ocupación</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Actualizado hace {horasDesdeActualizacion} hora{horasDesdeActualizacion !== 1 ? 's' : ''} · Basado en datos históricos + contexto de mercado
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <span className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-danger-bg border border-danger rounded-xl px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {!loading && data && (
        <>
          {!data.ia_disponible && (
            <div className="bg-warning-bg border border-warning rounded-xl px-4 py-3 text-sm text-warning">
              ⚠️ El servicio de pronóstico de IA no está disponible en este momento — mostrando solo el contexto de mercado disponible.
            </div>
          )}

          {/* Cards resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm p-4">
              <p className="text-xs font-semibold text-text-tertiary uppercase">📊 Ocupación promedio (30 días)</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{promedio !== null ? `${promedio.toFixed(1)}%` : '—'}</p>
            </div>
            <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm p-4">
              <p className="text-xs font-semibold text-text-tertiary uppercase">Tendencia</p>
              <p className={`text-2xl font-bold mt-1 ${TENDENCIA_INFO[data.tendencia].color}`}>
                {TENDENCIA_INFO[data.tendencia].icon} {TENDENCIA_INFO[data.tendencia].label}
              </p>
            </div>
            <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm p-4">
              <p className="text-xs font-semibold text-text-tertiary uppercase">🎪 Próximo evento relevante</p>
              {data.proximo_evento ? (
                <>
                  <p className="text-sm font-semibold text-text-primary mt-1">{data.proximo_evento.descripcion}</p>
                  <p className={`text-xs font-medium ${IMPACTO_INFO[data.proximo_evento.impacto_estimado]}`}>
                    {format(parseISO(data.proximo_evento.fecha_evento), 'dd/MM/yyyy')} · impacto {data.proximo_evento.impacto_estimado}
                  </p>
                </>
              ) : (
                <p className="text-sm text-text-secondary mt-1">Sin eventos próximos registrados</p>
              )}
            </div>
          </div>

          {/* Gráfica */}
          {data.proximos_30_dias.length > 0 && (
            <div className="bg-bg-card rounded-2xl border border-border-primary p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Ocupación estimada — próximos 30 días</h2>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={data.proximos_30_dias} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                  <XAxis
                    dataKey="fecha"
                    tickFormatter={d => format(parseISO(d), 'dd/MM')}
                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={v => `${v}%`}
                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${Number(value).toFixed(1)}%`,
                      name === 'ocupacion_estimada_pct' ? 'Ocupación estimada' : String(name),
                    ]}
                    labelFormatter={l => format(parseISO(String(l)), 'dd MMM yyyy')}
                  />
                  <Area type="monotone" dataKey="ocupacion_estimada_pct" fill="#3B82F6" fillOpacity={0.12} stroke="none" />
                  <Line type="monotone" dataKey="ocupacion_estimada_pct" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recomendaciones IA */}
          <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-2">Recomendaciones IA</h2>
            <p className="text-sm text-text-secondary">{data.recomendacion}</p>
          </div>
        </>
      )}
    </div>
  )
}
