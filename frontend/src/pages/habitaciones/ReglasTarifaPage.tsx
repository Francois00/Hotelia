import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'

interface Regla {
  id: string
  nombre: string
  tipo: string
  fecha_inicio?: string | null
  fecha_fin?: string | null
  ajuste_porcentaje: number
  estadia_minima_noches?: number | null
  activo: boolean
  aplica_a_tipos?: string[]
}

const TIPOS: { value: string; label: string; color: string }[] = [
  { value: 'TEMPORADA_ALTA',  label: 'Temporada Alta',   color: 'bg-orange-100 text-orange-800' },
  { value: 'TEMPORADA_BAJA',  label: 'Temporada Baja',   color: 'bg-info-bg text-info' },
  { value: 'FIN_DE_SEMANA',   label: 'Fin de Semana',    color: 'bg-purple-100 text-purple-800' },
  { value: 'EVENTO_ESPECIAL', label: 'Evento Especial',  color: 'bg-danger-bg text-danger' },
  { value: 'ESTADIA_LARGA',   label: 'Estadía Larga',    color: 'bg-success-bg text-success' },
]

const tipoColor = (tipo: string) => TIPOS.find(t => t.value === tipo)?.color ?? 'bg-bg-tertiary text-gray-700'
const tipoLabel = (tipo: string) => TIPOS.find(t => t.value === tipo)?.label ?? tipo

const needsDates = (tipo: string) => ['TEMPORADA_ALTA', 'TEMPORADA_BAJA', 'EVENTO_ESPECIAL'].includes(tipo)
const needsNoches = (tipo: string) => tipo === 'ESTADIA_LARGA'

interface FormState {
  nombre: string; tipo: string
  fecha_inicio: string; fecha_fin: string
  ajuste_porcentaje: string; estadia_minima_noches: string
}

export default function ReglasTarifaPage() {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>({
    nombre: '', tipo: 'EVENTO_ESPECIAL',
    fecha_inicio: '', fecha_fin: '',
    ajuste_porcentaje: '', estadia_minima_noches: '2',
  })

  const { data: reglas = [] } = useQuery<Regla[]>({
    queryKey: ['reglas-temporada'],
    queryFn: () => api.get<Regla[] | { data: Regla[] }>('/api/v1/reglas-temporada')
      .then(r => Array.isArray(r.data) ? r.data : (r.data.data ?? [])),
  })

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['reglas-temporada'] })
  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    setError('')
    if (!form.nombre.trim()) return setError('El nombre es requerido')
    if (!form.ajuste_porcentaje) return setError('El ajuste es requerido')
    if (needsDates(form.tipo) && (!form.fecha_inicio || !form.fecha_fin))
      return setError('Las fechas son requeridas para este tipo')

    setSaving(true)
    try {
      await api.post('/api/v1/reglas-temporada', {
        nombre:               form.nombre,
        tipo:                 form.tipo,
        ajuste_porcentaje:    parseFloat(form.ajuste_porcentaje),
        ...(needsDates(form.tipo) && { fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin }),
        ...(needsNoches(form.tipo) && { estadia_minima_noches: parseInt(form.estadia_minima_noches) }),
      })
      setForm({ nombre: '', tipo: 'EVENTO_ESPECIAL', fecha_inicio: '', fecha_fin: '', ajuste_porcentaje: '', estadia_minima_noches: '2' })
      await refetch()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al crear')
    } finally { setSaving(false) }
  }

  const handleToggle = async (id: string, activo: boolean) => {
    try {
      await api.put(`/api/v1/reglas-temporada/${id}`, { activo })
      await refetch()
    } catch { /* silencioso */ }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta regla?')) return
    try {
      await api.delete(`/api/v1/reglas-temporada/${id}`)
      await refetch()
    } catch { /* silencioso */ }
  }

  const ajusteDisplay = (n: number) => {
    const s = n >= 0 ? `+${n}%` : `${n}%`
    return <span className={n >= 0 ? 'text-success font-semibold' : 'text-red-500 font-semibold'}>{s}</span>
  }

  const ajustePreview = form.ajuste_porcentaje
    ? parseFloat(form.ajuste_porcentaje) >= 0
      ? <span className="text-success font-semibold">+{form.ajuste_porcentaje}%</span>
      : <span className="text-red-500 font-semibold">{form.ajuste_porcentaje}%</span>
    : null

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Reglas de Tarifa</h1>
        <p className="text-text-secondary text-sm mt-0.5">Configura ajustes automáticos de precio por temporada</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Tabla de reglas */}
        <div className="lg:col-span-3 bg-bg-card rounded-2xl border border-border-primary shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border-primary">
            <h2 className="text-sm font-semibold text-text-primary">Reglas activas</h2>
          </div>
          {reglas.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-text-tertiary">Sin reglas configuradas</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-bg-secondary border-b border-border-primary">
                  <tr>
                    {['Nombre', 'Tipo', 'Período', 'Ajuste', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reglas.map(r => (
                    <tr key={r.id} className="hover:bg-bg-secondary">
                      <td className="px-4 py-3 text-sm font-medium text-text-primary">{r.nombre}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipoColor(r.tipo)}`}>
                          {tipoLabel(r.tipo)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {needsDates(r.tipo) && r.fecha_inicio && r.fecha_fin
                          ? `${r.fecha_inicio} — ${r.fecha_fin}`
                          : needsNoches(r.tipo)
                          ? `≥ ${r.estadia_minima_noches} noches`
                          : 'Automático'}
                      </td>
                      <td className="px-4 py-3">{ajusteDisplay(r.ajuste_porcentaje)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => void handleToggle(r.id, !r.activo)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${r.activo ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-bg-card transition-transform ${r.activo ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => void handleDelete(r.id)}
                          className="text-xs text-red-500 hover:underline font-medium"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Formulario */}
        <div className="lg:col-span-2 bg-bg-card rounded-2xl border border-border-primary shadow-sm p-5 space-y-4 h-fit">
          <h2 className="text-sm font-semibold text-text-primary">Nueva regla</h2>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nombre *</label>
            <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ej: Fiestas Patrias" />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Tipo *</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {needsDates(form.tipo) && (
            <>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Fecha inicio *</label>
                <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Fecha fin *</label>
                <input type="date" value={form.fecha_fin} min={form.fecha_inicio} onChange={e => set('fecha_fin', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {needsNoches(form.tipo) && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Noches mínimas *</label>
              <input type="number" min={2} value={form.estadia_minima_noches} onChange={e => set('estadia_minima_noches', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Ajuste % *</label>
            <div className="flex items-center gap-2">
              <input type="number" value={form.ajuste_porcentaje} onChange={e => set('ajuste_porcentaje', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ej: 30 para +30%, -10 para -10%" />
              {ajustePreview && <span className="text-sm">{ajustePreview}</span>}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button onClick={handleCreate} disabled={saving}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creando...' : 'Crear regla'}
          </button>
        </div>
      </div>
    </div>
  )
}
