import { useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../api/client'

interface TipoCustom { id: string; nombre: string }

interface HabitacionFull {
  id: string
  numero: string
  piso: number
  tipo: string
  estado: string
  tipo_custom_id?: string | null
  descripcion?: string | null
  capacidad: number
  capacidad_adultos?: number | null
  capacidad_ninos?: number
  tarifa_base: number
  tarifa_minima?: number | null
  tarifa_maxima?: number | null
  moneda_tarifa?: string
  amenidades?: string[] | null
  fotos?: string[]
  visible_otas?: boolean
}

interface Props {
  habitacion: HabitacionFull | null
  onClose: () => void
  onSuccess: (h: HabitacionFull) => void
}

const TIPOS_PREDEFINIDOS = ['SIMPLE', 'DOBLE', 'TRIPLE', 'SUITE', 'FAMILIAR']

const parseAmenidades = (raw: unknown): string[] => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as string[]
  if (typeof raw === 'object')
    return Object.entries(raw as Record<string, unknown>).filter(([, v]) => v === true).map(([k]) => k)
  if (typeof raw === 'string') return raw.replace(/^\{|\}$/g, '').split(',').filter(Boolean)
  return []
}

const AMENITIES_PREDEFINIDOS = [
  'WiFi', 'Aire Acond.', 'TV Cable', 'Frigobar', 'Caja Fuerte', 'Bañera',
  'Ducha', 'Balcón', 'Vista al mar', 'Vista ciudad', 'Escritorio', 'Plancha',
  'Secador de pelo',
]

type Tab = 'datos' | 'tarifas' | 'amenities' | 'fotos'

interface FormData {
  numero: string
  piso: string
  tipo: string
  tipo_custom_id: string
  descripcion: string
  capacidad_adultos: string
  capacidad_ninos: string
  moneda: string
  tarifa_minima: string
  tarifa_base: string
  tarifa_maxima: string
  visible_otas: boolean
  amenidades: string[]
  amenidad_custom: string
}

interface FotoItem { file?: File; url: string; isNew: boolean }

export default function HabitacionForm({ habitacion, onClose, onSuccess }: Props) {
  const isEdit = !!habitacion
  const [tab, setTab] = useState<Tab>('datos')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<FormData>({
    numero:          habitacion?.numero ?? '',
    piso:            String(habitacion?.piso ?? 1),
    tipo:            habitacion?.tipo ?? 'DOBLE',
    tipo_custom_id:  habitacion?.tipo_custom_id ?? '',
    descripcion:     habitacion?.descripcion ?? '',
    capacidad_adultos: String(habitacion?.capacidad_adultos ?? habitacion?.capacidad ?? 2),
    capacidad_ninos: String(habitacion?.capacidad_ninos ?? 0),
    moneda:          habitacion?.moneda_tarifa ?? 'PEN',
    tarifa_minima:   habitacion?.tarifa_minima ? String(habitacion.tarifa_minima) : '',
    tarifa_base:     habitacion?.tarifa_base ? String(habitacion.tarifa_base) : '',
    tarifa_maxima:   habitacion?.tarifa_maxima ? String(habitacion.tarifa_maxima) : '',
    visible_otas:    habitacion?.visible_otas ?? true,
    amenidades:      parseAmenidades(habitacion?.amenidades),
    amenidad_custom: '',
  })

  const [fotos, setFotos] = useState<FotoItem[]>(
    (habitacion?.fotos ?? []).map(url => ({ url, isNew: false }))
  )
  const [dragOverFoto, setDragOverFoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: tiposCustom } = useQuery<TipoCustom[]>({
    queryKey: ['tipos-habitacion'],
    queryFn: () => api.get<{ data: TipoCustom[] }>('/api/v1/tipos-habitacion').then(r =>
      Array.isArray(r.data) ? r.data : (r.data.data ?? [])
    ),
  })

  const set = (k: keyof FormData, v: string | boolean | string[]) =>
    setForm(f => ({ ...f, [k]: v }))

  const toggleAmenidad = (a: string) =>
    set('amenidades', form.amenidades.includes(a)
      ? form.amenidades.filter(x => x !== a)
      : [...form.amenidades, a])

  const addAmenidadCustom = () => {
    const a = form.amenidad_custom.trim()
    if (a && !form.amenidades.includes(a)) {
      set('amenidades', [...form.amenidades, a])
    }
    set('amenidad_custom', '')
  }

  const removeFoto = (i: number) => setFotos(prev => prev.filter((_, idx) => idx !== i))

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const nuevas: FotoItem[] = Array.from(files)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name))
      .slice(0, 10 - fotos.length)
      .map(f => ({ file: f, url: URL.createObjectURL(f), isNew: true }))
    setFotos(prev => [...prev, ...nuevas])
  }, [fotos.length])

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOverFoto(false)
    addFiles(e.dataTransfer.files)
  }

  const min = parseFloat(form.tarifa_minima)
  const base = parseFloat(form.tarifa_base)
  const max = parseFloat(form.tarifa_maxima)
  const tarifaErrors = {
    minima: !isNaN(min) && !isNaN(base) && min >= base,
    maxima: !isNaN(max) && !isNaN(base) && max <= base,
  }

  const barPct = (v: number, lo: number, hi: number) => {
    if (isNaN(v) || isNaN(lo) || isNaN(hi) || hi <= lo) return 0
    return Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.numero.trim()) return setError('El número de habitación es requerido')
    if (!form.tarifa_base) return setError('La tarifa base es requerida')
    if (tarifaErrors.minima || tarifaErrors.maxima) return setError('Revisa las tarifas antes de guardar')

    setSaving(true)
    try {
      const body = {
        numero:            form.numero.trim(),
        piso:              parseInt(form.piso),
        tipo:              TIPOS_PREDEFINIDOS.includes(form.tipo) ? form.tipo : 'DOBLE',
        tipo_custom_id:    form.tipo_custom_id || null,
        descripcion:       form.descripcion || null,
        capacidad:         parseInt(form.capacidad_adultos) + parseInt(form.capacidad_ninos || '0'),
        capacidad_adultos: parseInt(form.capacidad_adultos),
        capacidad_ninos:   parseInt(form.capacidad_ninos || '0'),
        tarifa_base:       parseFloat(form.tarifa_base),
        tarifa_minima:     form.tarifa_minima ? parseFloat(form.tarifa_minima) : undefined,
        tarifa_maxima:     form.tarifa_maxima ? parseFloat(form.tarifa_maxima) : undefined,
        moneda_tarifa:     form.moneda,
        amenidades:        form.amenidades,
        visible_otas:      form.visible_otas,
      }

      const resp = isEdit
        ? await api.put<HabitacionFull>(`/api/v1/habitaciones/${habitacion!.id}`, body)
        : await api.post<HabitacionFull>('/api/v1/habitaciones', body)

      const saved = resp.data
      const id = saved.id

      const nuevas = fotos.filter(f => f.isNew && f.file)
      if (nuevas.length > 0) {
        const fd = new FormData()
        nuevas.forEach(f => fd.append('fotos', f.file!))
        await api.post(`/api/v1/habitaciones/${id}/fotos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      onSuccess({ ...saved, fotos: fotos.map(f => f.url) })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string; code?: string } } })
        ?.response?.data?.message
      setError(msg ?? 'Error al guardar la habitación')
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'datos', label: 'Datos generales' },
    { id: 'tarifas', label: 'Tarifas' },
    { id: 'amenities', label: 'Amenities' },
    { id: 'fotos', label: `Fotos (${fotos.length}/10)` },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? `Editar Hab. ${habitacion!.numero}` : 'Nueva habitación'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* TAB 1 — Datos generales */}
          {tab === 'datos' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
                  <input
                    type="text"
                    value={form.numero}
                    onChange={e => set('numero', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="101"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Piso *</label>
                  <input
                    type="number"
                    min={0}
                    value={form.piso}
                    onChange={e => set('piso', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  value={form.tipo}
                  onChange={e => set('tipo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TIPOS_PREDEFINIDOS.map(t => <option key={t} value={t}>{t}</option>)}
                  {tiposCustom?.map(t => <option key={t.id} value={t.id}>{t.nombre} (personalizado)</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => set('descripcion', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Descripción visible al huésped en Booking.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad adultos *</label>
                  <input
                    type="number"
                    min={1}
                    value={form.capacidad_adultos}
                    onChange={e => set('capacidad_adultos', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad niños</label>
                  <input
                    type="number"
                    min={0}
                    value={form.capacidad_ninos}
                    onChange={e => set('capacidad_ninos', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.visible_otas}
                  onChange={e => set('visible_otas', e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-sm text-gray-700">Visible en OTAs (Booking.com, Expedia)</span>
              </label>
            </div>
          )}

          {/* TAB 2 — Tarifas */}
          {tab === 'tarifas' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
                <div className="flex gap-4">
                  {['PEN', 'USD'].map(m => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="moneda"
                        value={m}
                        checked={form.moneda === m}
                        onChange={() => set('moneda', m)}
                        className="accent-blue-600"
                      />
                      <span className="text-sm text-gray-700">
                        {m === 'PEN' ? 'PEN — Soles' : 'USD — Dólares'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tarifa mínima ({form.moneda})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.tarifa_minima}
                    onChange={e => set('tarifa_minima', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      tarifaErrors.minima ? 'border-red-400' : 'border-gray-300'
                    }`}
                    placeholder="ej: 80"
                  />
                  {tarifaErrors.minima && (
                    <p className="text-xs text-red-500 mt-1">La tarifa mínima debe ser menor que la base</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tarifa base ({form.moneda}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.tarifa_base}
                    onChange={e => set('tarifa_base', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ej: 120"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tarifa máxima ({form.moneda})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.tarifa_maxima}
                    onChange={e => set('tarifa_maxima', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      tarifaErrors.maxima ? 'border-red-400' : 'border-gray-300'
                    }`}
                    placeholder="ej: 200"
                  />
                  {tarifaErrors.maxima && (
                    <p className="text-xs text-red-500 mt-1">La tarifa máxima debe ser mayor que la base</p>
                  )}
                </div>
              </div>

              {/* Visual bar */}
              {!isNaN(min) && !isNaN(base) && !isNaN(max) && max > min && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{form.moneda} {min}</span>
                    <span>{form.moneda} {max}</span>
                  </div>
                  <div className="relative h-3 bg-gray-200 rounded-full">
                    <div
                      className="absolute h-3 bg-blue-500 rounded-full"
                      style={{ left: `${barPct(min, min, max)}%`, width: `${barPct(max, min, max) - barPct(min, min, max)}%` }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-blue-700 rounded-full -top-0.5 -translate-x-1/2 border-2 border-white shadow"
                      style={{ left: `${barPct(base, min, max)}%` }}
                      title={`Base: ${form.moneda} ${base}`}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">Base: {form.moneda} {base}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3 — Amenities */}
          {tab === 'amenities' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {AMENITIES_PREDEFINIDOS.map(a => (
                  <label key={a} className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={form.amenidades.includes(a)}
                      onChange={() => toggleAmenidad(a)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">{a}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={form.amenidad_custom}
                  onChange={e => set('amenidad_custom', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addAmenidadCustom()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Agregar amenity personalizado..."
                />
                <button
                  onClick={addAmenidadCustom}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  Agregar
                </button>
              </div>
              {form.amenidades.filter(a => !AMENITIES_PREDEFINIDOS.includes(a)).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.amenidades
                    .filter(a => !AMENITIES_PREDEFINIDOS.includes(a))
                    .map(a => (
                      <span key={a} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {a}
                        <button onClick={() => toggleAmenidad(a)} className="ml-1 hover:text-red-600">&times;</button>
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4 — Fotos */}
          {tab === 'fotos' && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDragOverFoto(true) }}
                onDragLeave={() => setDragOverFoto(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOverFoto ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <p className="text-2xl mb-2">📷</p>
                <p className="text-sm text-gray-600 font-medium">Arrastra fotos aquí o haz clic para seleccionar</p>
                <p className="text-xs text-gray-400 mt-1">JPG, JPEG, PNG, WEBP · Máx 5 MB por foto</p>
                <p className="text-xs text-gray-500 mt-2">{fotos.length} / 10 fotos</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={e => addFiles(e.target.files)}
                />
              </div>
              {fotos.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {fotos.map((f, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={f.url}
                        alt={`foto-${i}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                      />
                      {i === 0 && (
                        <span className="absolute top-1 left-1 text-yellow-400 text-lg leading-none">★</span>
                      )}
                      <button
                        onClick={() => removeFoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!error && <span />}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {saving ? 'Guardando...' : 'Guardar habitación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
