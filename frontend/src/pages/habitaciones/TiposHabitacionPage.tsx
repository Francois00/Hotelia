import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'

interface TipoHabitacion {
  id: string
  nombre: string
  descripcion?: string | null
  color_mapa?: string | null
  activo?: boolean
  predefinido?: boolean
}

const PREDEFINIDOS = ['SIMPLE', 'DOBLE', 'TRIPLE', 'SUITE', 'FAMILIAR']

export default function TiposHabitacionPage() {
  const queryClient = useQueryClient()
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<TipoHabitacion>>({})
  const [form, setForm] = useState({ nombre: '', descripcion: '', color_mapa: '#3b82f6' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { data: tipos = [] } = useQuery<TipoHabitacion[]>({
    queryKey: ['tipos-habitacion'],
    queryFn: () => api.get<TipoHabitacion[] | { data: TipoHabitacion[] }>('/api/v1/tipos-habitacion')
      .then(r => Array.isArray(r.data) ? r.data : (r.data.data ?? [])),
  })

  const tiposCompletos: TipoHabitacion[] = [
    ...PREDEFINIDOS.map(n => ({ id: n, nombre: n, predefinido: true, activo: true })),
    ...tipos.filter(t => !PREDEFINIDOS.includes(t.nombre.toUpperCase())),
  ]

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['tipos-habitacion'] })

  const handleCreate = async () => {
    if (!form.nombre.trim()) return setError('El nombre es requerido')
    setSaving(true)
    setError('')
    try {
      await api.post('/api/v1/tipos-habitacion', form)
      setForm({ nombre: '', descripcion: '', color_mapa: '#3b82f6' })
      await refetch()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al crear')
    } finally { setSaving(false) }
  }

  const handleSaveEdit = async (id: string) => {
    try {
      await api.put(`/api/v1/tipos-habitacion/${id}`, editData)
      setEditId(null)
      await refetch()
    } catch { /* silencioso */ }
  }

  const handleToggle = async (id: string, activo: boolean) => {
    try {
      await api.put(`/api/v1/tipos-habitacion/${id}`, { activo })
      await refetch()
    } catch { /* silencioso */ }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Tipos de Habitación</h1>
        <p className="text-text-secondary text-sm mt-0.5">Gestiona los tipos personalizados de habitación</p>
      </div>

      {/* Tabla */}
      <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg-secondary border-b border-border-primary">
              <tr>
                {['Nombre', 'Descripción', 'Color', 'Activo', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tiposCompletos.map(t => (
                <tr key={t.id} className="hover:bg-bg-secondary">
                  <td className="px-4 py-3">
                    {editId === t.id ? (
                      <input
                        type="text"
                        value={editData.nombre ?? t.nombre}
                        onChange={e => setEditData(d => ({ ...d, nombre: e.target.value }))}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    ) : (
                      <span className="text-sm font-medium text-text-primary">{t.nombre}</span>
                    )}
                    {t.predefinido && (
                      <span className="ml-2 px-1.5 py-0.5 bg-bg-tertiary text-text-secondary text-xs rounded">predefinido</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === t.id ? (
                      <input
                        type="text"
                        value={editData.descripcion ?? t.descripcion ?? ''}
                        onChange={e => setEditData(d => ({ ...d, descripcion: e.target.value }))}
                        className="px-2 py-1 border border-gray-300 rounded text-sm w-full"
                      />
                    ) : (
                      <span className="text-sm text-text-secondary">{t.descripcion ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === t.id ? (
                      <input
                        type="color"
                        value={editData.color_mapa ?? t.color_mapa ?? '#3b82f6'}
                        onChange={e => setEditData(d => ({ ...d, color_mapa: e.target.value }))}
                        className="w-10 h-8 rounded cursor-pointer border border-gray-300"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded border border-border-primary" style={{ backgroundColor: t.color_mapa ?? '#3b82f6' }} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!t.predefinido ? (
                      <button
                        onClick={() => void handleToggle(t.id, !(t.activo ?? true))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${(t.activo ?? true) ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-bg-card transition-transform ${(t.activo ?? true) ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    ) : (
                      <span className="text-xs text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!t.predefinido && (
                      editId === t.id ? (
                        <div className="flex gap-2">
                          <button onClick={() => void handleSaveEdit(t.id)} className="text-xs text-blue-600 font-medium hover:underline">Guardar</button>
                          <button onClick={() => setEditId(null)} className="text-xs text-text-secondary hover:underline">Cancelar</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditId(t.id); setEditData({}) }}
                          className="text-xs text-blue-600 font-medium hover:underline"
                        >
                          Editar
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulario nuevo tipo */}
      <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Nuevo tipo</h2>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-text-secondary mb-1">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ej: Junior Suite"
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-text-secondary mb-1">Descripción</label>
            <input
              type="text"
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Color</label>
            <input
              type="color"
              value={form.color_mapa}
              onChange={e => setForm(f => ({ ...f, color_mapa: e.target.value }))}
              className="w-12 h-9 rounded-lg cursor-pointer border border-gray-300"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear tipo'}
          </button>
        </div>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  )
}
