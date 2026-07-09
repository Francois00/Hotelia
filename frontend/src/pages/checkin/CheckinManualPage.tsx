import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, addDays, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '../../api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Habitacion {
  id: string; numero: string; piso: number; tipo: string
  capacidad: number; capacidad_adultos?: number | null; capacidad_ninos?: number
  tarifa_base: number; tarifa_sugerida_hoy?: number
  descripcion?: string | null; amenidades?: string[] | null
}

interface Pago { metodo: string; monto: string; referencia: string }

interface WizardState {
  habitacion: Habitacion | null
  fecha_entrada: string; numero_noches: number; fecha_salida: string; numero_personas: number
  precio_por_noche: number; total: number
  tipo_documento: string; numero_documento: string
  huesped_id: string | null; nombres: string; apellidos: string
  email: string; telefono: string; is_returning: boolean; observaciones: string
  pagos: Pago[]
  tipo_comprobante: 'boleta' | 'factura'
  ruc: string; razon_social: string; dir_factura: string; email_factura: string
  canal_envio: string[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const METODOS = [
  { value: 'EFECTIVO', label: '💵 Efectivo' },
  { value: 'YAPE', label: '📱 Yape' },
  { value: 'PLIN', label: '📱 Plin' },
  { value: 'TARJETA_DEBITO', label: '💳 Tarjeta débito' },
  { value: 'TARJETA_CREDITO', label: '💳 Tarjeta crédito' },
  { value: 'TRANSFERENCIA', label: '🏦 Transferencia' },
]

const DOCUMENTOS = [
  { value: 'DNI', label: 'DNI', placeholder: '12345678 (8 dígitos)' },
  { value: 'RUC', label: 'RUC', placeholder: '20123456789 (11 dígitos)' },
  { value: 'PASAPORTE', label: 'Pasaporte', placeholder: 'Número de pasaporte' },
  { value: 'CARNET', label: 'Carnet de Extranjería', placeholder: 'Número de carnet' },
  { value: 'OTRO', label: 'Otro documento', placeholder: 'Número de documento' },
]

const today = format(new Date(), 'yyyy-MM-dd')

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)

const ERRORES: Record<string, string> = {
  HABITACION_NO_DISPONIBLE: 'La habitación fue tomada mientras completabas el registro. Vuelve al Paso 1 para elegir otra.',
  CAPACIDAD_EXCEDIDA: 'El número de personas supera la capacidad de esta habitación.',
  PAGOS_NO_COINCIDEN: 'El total de los pagos no coincide con el monto de la reserva.',
  FECHAS_INVALIDAS: 'Las fechas ingresadas no son válidas.',
}

// ─── Step bar ────────────────────────────────────────────────────────────────

function StepBar({ current, completed, onGo }: { current: number; completed: Set<number>; onGo: (s: number) => void }) {
  const steps = ['Habitación', 'Cliente', 'Pago', 'Comprobante', 'Confirmar']
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const n = i + 1
        const active = n === current
        const done = completed.has(n)
        return (
          <div key={n} className="flex items-center flex-1">
            <div className={`flex flex-col items-center min-w-0 ${n < steps.length ? 'flex-1' : ''}`}>
              <div
                onClick={() => done && onGo(n)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  active ? 'bg-blue-600 border-blue-600 text-white'
                  : done ? 'bg-green-500 border-green-500 text-white cursor-pointer hover:bg-green-600'
                  : 'bg-bg-card border-gray-300 text-text-tertiary'
                }`}
              >
                {done ? '✓' : n}
              </div>
              <span
                onClick={() => done && onGo(n)}
                className={`text-xs mt-1 font-medium ${active ? 'text-blue-600' : done ? 'text-success cursor-pointer hover:underline' : 'text-text-tertiary'}`}
              >
                {label}
              </span>
            </div>
            {n < steps.length && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Paso 1 — Habitación ──────────────────────────────────────────────────────

function Paso1({
  data, onUpdate, onNext,
}: {
  data: WizardState
  onUpdate: (d: Partial<WizardState>) => void
  onNext: () => void
}) {
  const [subView, setSubView] = useState<'lista' | 'mapa'>('lista')
  const [disponibles, setDisponibles] = useState<Habitacion[]>([])
  const [loading, setLoading] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState('')

  const buscar = async () => {
    setError('')
    setLoading(true)
    try {
      const r = await api.get<{ data: Habitacion[] } | Habitacion[]>('/api/v1/habitaciones/disponibles', {
        params: {
          fecha_entrada: data.fecha_entrada,
          fecha_salida:  data.fecha_salida,
          personas:      data.numero_personas,
        },
      })
      const arr = Array.isArray(r.data) ? r.data : (r.data.data ?? [])
      setDisponibles(arr)
      setBuscado(true)
    } catch { setError('Error al buscar disponibilidad') }
    finally { setLoading(false) }
  }

  const seleccionar = (h: Habitacion) => {
    const precio = h.tarifa_sugerida_hoy ?? h.tarifa_base
    onUpdate({
      habitacion: h,
      precio_por_noche: precio,
      total: precio * data.numero_noches,
    })
  }

  const cambiarNoches = (n: number) => {
    const noches = Math.max(1, n)
    const salida = format(addDays(new Date(data.fecha_entrada), noches), 'yyyy-MM-dd')
    onUpdate({ numero_noches: noches, fecha_salida: salida, total: data.precio_por_noche * noches })
  }

  const cambiarSalida = (s: string) => {
    const noches = Math.max(1, differenceInCalendarDays(new Date(s), new Date(data.fecha_entrada)))
    onUpdate({ fecha_salida: s, numero_noches: noches, total: data.precio_por_noche * noches })
  }

  const validarContinuar = () => {
    if (!data.habitacion) return setError('Selecciona una habitación')
    const cap = (data.habitacion.capacidad_adultos ?? data.habitacion.capacidad) + (data.habitacion.capacidad_ninos ?? 0)
    if (data.numero_personas > cap) return setError(`Esta habitación tiene capacidad para ${cap} personas máximo`)
    onNext()
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna izquierda */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de entrada</label>
            <input type="date" value={data.fecha_entrada} min={today}
              onChange={e => onUpdate({ fecha_entrada: e.target.value, fecha_salida: format(addDays(new Date(e.target.value), data.numero_noches), 'yyyy-MM-dd') })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Noches</label>
              <input type="number" min={1} value={data.numero_noches}
                onChange={e => cambiarNoches(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de salida</label>
              <input type="date" value={data.fecha_salida} min={data.fecha_entrada}
                onChange={e => cambiarSalida(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de personas</label>
            <input type="number" min={1} value={data.numero_personas}
              onChange={e => onUpdate({ numero_personas: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={buscar} disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Buscando...' : 'Buscar disponibilidad'}
          </button>

          {/* Habitación seleccionada */}
          {data.habitacion && (
            <div className="border border-success bg-success-bg rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-success">
                ✅ Hab. {data.habitacion.numero} — {data.habitacion.tipo} · Piso {data.habitacion.piso} seleccionada
              </p>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Precio por noche (editable)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">S/</span>
                  <input type="number" step="0.01" min={0} value={data.precio_por_noche}
                    onChange={e => onUpdate({ precio_por_noche: parseFloat(e.target.value) || 0, total: (parseFloat(e.target.value) || 0) * data.numero_noches })}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-bg-card" />
                </div>
                {data.habitacion.tarifa_sugerida_hoy && (
                  <p className="text-xs text-text-secondary mt-0.5">Sugerido por IA: {formatCurrency(data.habitacion.tarifa_sugerida_hoy)}</p>
                )}
              </div>
              <div className="text-sm text-gray-700">
                <span className="font-semibold">{data.numero_noches}</span> noches ×{' '}
                <span className="font-semibold">{formatCurrency(data.precio_por_noche)}</span> ={' '}
                <span className="font-bold text-text-primary">{formatCurrency(data.total)}</span>
              </div>
              <p className="text-xs text-text-secondary">
                Check-out: {format(new Date(data.fecha_salida), "EEEE d 'de' MMMM", { locale: es })}
              </p>
            </div>
          )}
        </div>

        {/* Columna derecha — resultados */}
        <div>
          {/* Sub-tabs */}
          {buscado && disponibles.length > 0 && (
            <div className="flex border-b border-border-primary mb-4">
              {(['mapa', 'lista'] as const).map(v => (
                <button key={v} onClick={() => setSubView(v)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors ${subView === v ? 'border-blue-600 text-blue-600' : 'border-transparent text-text-secondary hover:text-gray-700'}`}>
                  {v === 'mapa' ? 'Mapa' : 'Lista'}
                </button>
              ))}
            </div>
          )}

          {loading && <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}
          {!loading && buscado && disponibles.length === 0 && (
            <div className="text-center py-12 text-text-tertiary text-sm">Sin habitaciones disponibles para estas fechas</div>
          )}

          {/* Vista mapa por pisos */}
          {!loading && disponibles.length > 0 && subView === 'mapa' && (() => {
            const pisos = [...new Set(disponibles.map(h => h.piso))].sort((a, b) => a - b)
            return (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {pisos.map(piso => (
                  <div key={piso} className="bg-bg-card border border-border-primary rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-bg-secondary border-b border-border-primary">
                      <span className="text-xs font-semibold text-text-secondary uppercase">Piso {piso}</span>
                    </div>
                    <div className="p-3 flex flex-wrap gap-2">
                      {disponibles.filter(h => h.piso === piso).map(h => {
                        const selected = data.habitacion?.id === h.id
                        return (
                          <button key={h.id} onClick={() => seleccionar(h)}
                            title={`${h.tipo} · ${formatCurrency(h.tarifa_sugerida_hoy ?? h.tarifa_base)}/noche`}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition-all hover:scale-105 ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-success-bg border-green-400 text-success hover:bg-success-bg'}`}>
                            {h.numero}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Vista lista */}
          {!loading && disponibles.length > 0 && subView === 'lista' && (
            <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {disponibles.map(h => {
                const ia = h.tarifa_sugerida_hoy
                const selected = data.habitacion?.id === h.id
                return (
                  <div key={h.id}
                    onClick={() => seleccionar(h)}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${selected ? 'border-blue-500 bg-info-bg' : 'border-border-primary bg-bg-card hover:border-gray-300'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-text-primary">Hab. {h.numero} — {h.tipo}</span>
                      <span className="text-xs text-text-secondary">Piso {h.piso}</span>
                    </div>
                    <p className="text-xs text-text-secondary mb-2">
                      👥 {h.capacidad_adultos ?? h.capacidad} adultos
                      {(Array.isArray(h.amenidades) ? h.amenidades : []).slice(0, 3).map((a: string) => ` · ${a}`).join('')}
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-text-primary">{formatCurrency(h.tarifa_base)}/noche</span>
                        {ia && ia !== h.tarifa_base && (
                          <span className={`ml-2 text-xs font-medium ${ia > h.tarifa_base ? 'text-success' : 'text-orange-500'}`}>
                            IA: {formatCurrency(ia)}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); seleccionar(h) }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg ${selected ? 'bg-blue-600 text-white' : 'bg-bg-tertiary text-gray-700 hover:bg-gray-200'}`}>
                        {selected ? 'Seleccionada ✓' : 'Seleccionar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end">
        <button onClick={validarContinuar}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
          Continuar →
        </button>
      </div>
    </div>
  )
}

// ─── Paso 2 — Cliente ─────────────────────────────────────────────────────────

function Paso2({
  data, onUpdate, onNext, onBack,
}: {
  data: WizardState; onUpdate: (d: Partial<WizardState>) => void
  onNext: () => void; onBack: () => void
}) {
  const [buscando, setBuscando] = useState(false)
  const [banner, setBanner] = useState<{ tipo: 'verde' | 'azul' | 'gris'; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const buscarCliente = async () => {
    const doc = data.numero_documento.trim()
    if (!doc) return
    setBuscando(true)
    setBanner(null)
    try {
      // Etapa 1: buscar en BD
      try {
        const r = await api.get<{ encontrado: boolean; huesped?: { id: string; nombre: string; apellido: string; email: string; telefono: string; total_estancias: number } }>(
          `/api/v1/huespedes?tipo_documento=${data.tipo_documento}&numero_documento=${doc}`
        )
        if (r.data.encontrado && r.data.huesped) {
          const h = r.data.huesped
          onUpdate({
            huesped_id: h.id, nombres: h.nombre, apellidos: h.apellido,
            email: h.email ?? '', telefono: h.telefono ?? '', is_returning: true,
          })
          setBanner({ tipo: 'verde', msg: `✅ Cliente registrado — ${h.total_estancias} visita(s) anteriores` })
          return
        }
      } catch { /* continúa a RENIEC */ }

      // Etapa 2: RENIEC/SUNAT
      try {
        if (data.tipo_documento === 'DNI') {
          const r = await api.get<{ encontrado: boolean; nombres?: string; apellidos?: string }>(`/api/v1/clientes/reniec/${doc}`)
          if (r.data.encontrado) {
            onUpdate({ nombres: r.data.nombres ?? '', apellidos: r.data.apellidos ?? '', huesped_id: null, is_returning: false })
            setBanner({ tipo: 'azul', msg: 'ℹ️ Datos obtenidos de RENIEC — completa los datos de contacto' })
            return
          }
        } else if (data.tipo_documento === 'RUC') {
          const r = await api.get<{ encontrado: boolean; razon_social?: string }>(`/api/v1/clientes/sunat/${doc}`)
          if (r.data.encontrado) {
            onUpdate({ nombres: r.data.razon_social ?? '', apellidos: '', huesped_id: null, is_returning: false })
            setBanner({ tipo: 'azul', msg: 'ℹ️ Datos obtenidos de SUNAT — completa los datos de contacto' })
            return
          }
        }
      } catch { /* timeout */ }

      onUpdate({ huesped_id: null, is_returning: false })
      setBanner({
        tipo: 'gris',
        msg: data.tipo_documento === 'DNI' || data.tipo_documento === 'RUC'
          ? '⚠️ API no disponible — ingresa los datos manualmente'
          : '📝 Ingresa los datos del huésped',
      })
    } finally {
      setBuscando(false)
    }
  }

  const handleContinuar = async () => {
    if (!data.nombres.trim() || !data.apellidos.trim()) return
    setSaving(true)
    try {
      if (!data.huesped_id) {
        const r = await api.post<{ id: string; is_returning: boolean }>('/api/v1/huespedes', {
          tipo_documento: data.tipo_documento,
          numero_documento: data.numero_documento,
          nombres: data.nombres, apellidos: data.apellidos,
          email: data.email || null, telefono: data.telefono || null,
          observaciones: data.observaciones || null,
        })
        onUpdate({ huesped_id: r.data.id, is_returning: r.data.is_returning })
      }
      onNext()
    } catch { /* continúa de todas formas */ onNext()
    } finally { setSaving(false) }
  }

  const bannerColor = banner?.tipo === 'verde' ? 'bg-success-bg border-success text-success'
    : banner?.tipo === 'azul' ? 'bg-info-bg border-info text-info'
    : 'bg-bg-secondary border-gray-300 text-text-secondary'

  const readOnly = data.is_returning

  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <div className="w-40 shrink-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <select value={data.tipo_documento} onChange={e => onUpdate({ tipo_documento: e.target.value, numero_documento: '', nombres: '', apellidos: '', huesped_id: null, is_returning: false })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {DOCUMENTOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Número de documento</label>
          <div className="flex gap-2">
            <input type="text" value={data.numero_documento}
              onChange={e => onUpdate({ numero_documento: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && void buscarCliente()}
              placeholder={DOCUMENTOS.find(d => d.value === data.tipo_documento)?.placeholder}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={() => void buscarCliente()} disabled={buscando}
              className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap">
              {buscando ? '...' : 'Buscar'}
            </button>
          </div>
        </div>
      </div>

      {banner && (
        <div className={`px-4 py-3 rounded-xl border text-sm font-medium ${bannerColor}`}>
          {banner.msg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombres *</label>
          <input type="text" value={data.nombres} onChange={e => !readOnly && onUpdate({ nombres: e.target.value })}
            readOnly={readOnly}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${readOnly ? 'bg-bg-secondary' : ''}`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos *</label>
          <input type="text" value={data.apellidos} onChange={e => !readOnly && onUpdate({ apellidos: e.target.value })}
            readOnly={readOnly}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${readOnly ? 'bg-bg-secondary' : ''}`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={data.email} onChange={e => onUpdate({ email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input type="tel" value={data.telefono} onChange={e => onUpdate({ telefono: e.target.value })}
            placeholder="+51 999 999 999"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones internas</label>
          <textarea value={data.observaciones} onChange={e => onUpdate({ observaciones: e.target.value })}
            rows={2} placeholder="Notas internas del recepcionista"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-bg-secondary">← Volver</button>
        <button onClick={() => void handleContinuar()} disabled={saving || !data.nombres || !data.apellidos}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Continuar →'}
        </button>
      </div>
    </div>
  )
}

// ─── Paso 3 — Pago ────────────────────────────────────────────────────────────

function Paso3({
  data, onUpdate, onNext, onBack,
}: {
  data: WizardState; onUpdate: (d: Partial<WizardState>) => void
  onNext: () => void; onBack: () => void
}) {
  const [overrideConfirm, setOverrideConfirm] = useState(false)
  const suma = data.pagos.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0)
  const diff = suma - data.total
  const hayEfectivo = data.pagos.some(p => p.metodo === 'EFECTIVO')
  const [monto_recibido, setMontoRecibido] = useState('')

  const addPago = () => onUpdate({ pagos: [...data.pagos, { metodo: 'EFECTIVO', monto: '', referencia: '' }] })
  const removePago = (i: number) => onUpdate({ pagos: data.pagos.filter((_, idx) => idx !== i) })
  const updatePago = (i: number, key: keyof Pago, val: string) => {
    const ps = [...data.pagos]
    ps[i] = { ...ps[i], [key]: val }
    onUpdate({ pagos: ps })
  }

  const validarContinuar = () => {
    if (data.pagos.length === 0) return
    if (suma < data.total - 0.01) return
    if (suma > data.total + 0.01 && !overrideConfirm) { setOverrideConfirm(true); return }
    onNext()
  }

  const montoRecibidoNum = parseFloat(monto_recibido) || 0
  const vuelto = montoRecibidoNum - data.total

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-secondary">Hab. {data.habitacion?.numero} · {data.nombres} {data.apellidos}</p>
            <p className="text-xs text-text-secondary">{data.fecha_entrada} → {data.fecha_salida}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-secondary uppercase font-semibold">Total a pagar</p>
            <p className="text-xl font-bold text-text-primary">{formatCurrency(data.total)}</p>
          </div>
        </div>
      </div>

      {/* Métodos */}
      <div className="space-y-3">
        {data.pagos.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={p.metodo} onChange={e => updatePago(i, 'metodo', e.target.value)}
              className="w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">S/</span>
              <input type="number" step="0.01" min={0} value={p.monto} onChange={e => updatePago(i, 'monto', e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <input type="text" value={p.referencia} onChange={e => updatePago(i, 'referencia', e.target.value)}
              placeholder="Referencia (opcional)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {data.pagos.length > 1 && (
              <button onClick={() => removePago(i)} className="text-text-tertiary hover:text-red-500 text-lg leading-none px-1">&times;</button>
            )}
          </div>
        ))}
        <button onClick={addPago} className="text-sm text-blue-600 hover:underline font-medium">+ Agregar otro método de pago</button>
      </div>

      {/* Totales */}
      <div className="bg-bg-card border border-border-primary rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Total a pagar:</span>
          <span className="font-semibold">{formatCurrency(data.total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Total ingresado:</span>
          <span className={`font-semibold ${Math.abs(diff) < 0.01 ? 'text-success' : diff < 0 ? 'text-red-500' : 'text-yellow-600'}`}>
            {formatCurrency(suma)}
          </span>
        </div>
        {Math.abs(diff) > 0.01 && (
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Diferencia:</span>
            <span className={diff > 0 ? 'text-yellow-600 font-medium' : 'text-red-500 font-medium'}>
              {diff > 0 ? '+' : ''}{formatCurrency(diff)}
            </span>
          </div>
        )}
      </div>

      {hayEfectivo && (
        <div className="border border-border-primary rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">Efectivo</p>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">S/</span>
              <input type="number" step="0.01" min={0} value={monto_recibido} onChange={e => setMontoRecibido(e.target.value)}
                placeholder="Monto recibido"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {monto_recibido && (
              <span className={`text-sm font-semibold ${vuelto >= 0 ? 'text-success' : 'text-red-500'}`}>
                Vuelto: {formatCurrency(vuelto)}
              </span>
            )}
          </div>
        </div>
      )}

      {suma < data.total - 0.01 && (
        <p className="text-sm text-red-500 font-medium">Faltan {formatCurrency(data.total - suma)} por cubrir</p>
      )}
      {overrideConfirm && suma > data.total + 0.01 && (
        <div className="bg-warning-bg border border-warning rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm text-warning">El monto supera el total. ¿Es correcto?</p>
          <button onClick={onNext} className="px-3 py-1.5 bg-yellow-500 text-white text-xs font-medium rounded-lg">
            Sí, continuar
          </button>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-bg-secondary">← Volver</button>
        <button onClick={validarContinuar} disabled={data.pagos.length === 0 || suma < data.total - 0.01}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
          Continuar →
        </button>
      </div>
    </div>
  )
}

// ─── Paso 4 — Comprobante ─────────────────────────────────────────────────────

function Paso4({
  data, onUpdate, onNext, onBack,
}: {
  data: WizardState; onUpdate: (d: Partial<WizardState>) => void
  onNext: () => void; onBack: () => void
}) {
  useEffect(() => {
    if (data.tipo_documento === 'RUC') onUpdate({ tipo_comprobante: 'factura' })
  }, [])

  const toggleCanal = (c: string) => {
    const cs = data.canal_envio.includes(c)
      ? data.canal_envio.filter(x => x !== c)
      : [...data.canal_envio, c]
    onUpdate({ canal_envio: cs })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {[
          { value: 'boleta', label: 'Boleta de venta' },
          { value: 'factura', label: 'Factura electrónica' },
        ].map(opt => (
          <label key={opt.value} className="flex items-center gap-3 cursor-pointer p-4 border-2 rounded-xl hover:bg-bg-secondary transition-colors">
            <input type="radio" name="comprobante" value={opt.value}
              checked={data.tipo_comprobante === opt.value}
              onChange={() => onUpdate({ tipo_comprobante: opt.value as 'boleta' | 'factura' })}
              className="accent-blue-600" />
            <span className="text-sm font-medium text-text-primary">{opt.label}</span>
          </label>
        ))}
      </div>

      {data.tipo_comprobante === 'factura' && (
        <div className="border border-border-primary rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Datos para la factura</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">RUC</label>
              <input type="text" value={data.ruc} onChange={e => onUpdate({ ruc: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Razón social</label>
              <input type="text" value={data.razon_social} onChange={e => onUpdate({ razon_social: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Dirección</label>
              <input type="text" value={data.dir_factura} onChange={e => onUpdate({ dir_factura: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Email factura</label>
              <input type="email" value={data.email_factura} onChange={e => onUpdate({ email_factura: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      )}

      <div className="border border-border-primary rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Enviar comprobante por</h3>
        {[
          { value: 'whatsapp', label: 'WhatsApp', sub: data.telefono ? `Se enviará a: ${data.telefono}` : '' },
          { value: 'email', label: 'Correo electrónico', sub: data.email ? `Se enviará a: ${data.email}` : '' },
          { value: 'imprimir', label: 'Solo imprimir', sub: '' },
        ].map(opt => (
          <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={data.canal_envio.includes(opt.value)} onChange={() => toggleCanal(opt.value)}
              className="mt-0.5 w-4 h-4 accent-blue-600" />
            <div>
              <span className="text-sm text-text-primary">{opt.label}</span>
              {opt.sub && <p className="text-xs text-text-secondary">{opt.sub}</p>}
            </div>
          </label>
        ))}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-bg-secondary">← Volver</button>
        <button onClick={onNext} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
          Continuar →
        </button>
      </div>
    </div>
  )
}

// ─── Paso 5 — Confirmar ───────────────────────────────────────────────────────

interface CheckinResult {
  reserva_id: string; codigo_reserva: string
  habitacion_numero: string; huesped_nombre: string
  fecha_entrada: string; fecha_salida: string; total: number
}

function Paso5({
  data, onBack, onSuccess,
}: {
  data: WizardState; onBack: () => void; onSuccess: (r: CheckinResult) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const confirmar = async () => {
    setError('')
    setLoading(true)
    try {
      const r = await api.post<CheckinResult>('/api/v1/reservas/checkin-manual', {
        huesped_id:              data.huesped_id,
        habitacion_id:           data.habitacion!.id,
        fecha_entrada:           data.fecha_entrada,
        numero_noches:           data.numero_noches,
        numero_personas:         data.numero_personas,
        precio_por_noche:        data.precio_por_noche,
        pagos:                   data.pagos.map(p => ({ metodo: p.metodo, monto: parseFloat(p.monto), referencia: p.referencia || null })),
        tipo_comprobante:        data.tipo_comprobante.toUpperCase(),
        datos_facturacion:       data.tipo_comprobante === 'factura' ? {
          ruc: data.ruc, razon_social: data.razon_social, direccion: data.dir_factura, email: data.email_factura,
        } : null,
        canal_envio_comprobante: data.canal_envio[0] ?? 'imprimir',
      })
      onSuccess(r.data)
    } catch (e: unknown) {
      const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code
      setError(ERRORES[code ?? ''] ?? 'Error al procesar el check-in. Intenta nuevamente.')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      {/* Tarjeta resumen */}
      <div className="border border-border-primary rounded-2xl overflow-hidden">
        <div className="bg-bg-secondary px-5 py-3 border-b border-border-primary">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide text-center">Resumen Check-in</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-text-tertiary uppercase mb-2">🏠 Habitación</p>
            <p className="text-sm font-medium text-text-primary">Hab. {data.habitacion?.numero} — {data.habitacion?.tipo} · Piso {data.habitacion?.piso}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-text-tertiary uppercase mb-2">👤 Huésped</p>
            <p className="text-sm font-medium text-text-primary">{data.nombres} {data.apellidos}</p>
            <p className="text-xs text-text-secondary">{data.tipo_documento}: {data.numero_documento}</p>
            {data.telefono && <p className="text-xs text-text-secondary">📱 {data.telefono}</p>}
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-text-tertiary uppercase mb-2">📅 Fechas</p>
            <p className="text-sm text-text-primary">Entrada: {format(new Date(data.fecha_entrada), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}</p>
            <p className="text-sm text-text-primary">Salida: {format(new Date(data.fecha_salida), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}</p>
            <p className="text-sm text-gray-700 font-medium mt-1">Estadía: {data.numero_noches} noches · Check-out a las 12:00</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-text-tertiary uppercase mb-2">💰 Pago</p>
            <p className="text-sm text-text-secondary">{data.numero_noches} noches × {formatCurrency(data.precio_por_noche)} = <span className="font-bold text-text-primary">{formatCurrency(data.total)}</span></p>
            {data.pagos.map((p, i) => (
              <p key={i} className="text-sm text-text-secondary">{METODOS.find(m => m.value === p.metodo)?.label}: {formatCurrency(parseFloat(p.monto) || 0)}</p>
            ))}
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-text-tertiary uppercase mb-2">🧾 Comprobante</p>
            <p className="text-sm text-text-primary capitalize">{data.tipo_comprobante} de venta</p>
            {data.canal_envio.length > 0 && <p className="text-xs text-text-secondary">Envío: {data.canal_envio.join(', ')}</p>}
          </div>
        </div>
      </div>

      {error && <div className="bg-danger-bg border border-danger rounded-xl px-4 py-3 text-sm text-danger">{error}</div>}

      <div className="flex justify-between">
        <button onClick={onBack} className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-bg-secondary">← Modificar</button>
        <button onClick={() => void confirmar()} disabled={loading}
          className="px-6 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
          {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {loading ? 'Procesando check-in...' : '✅ Confirmar Check-in'}
        </button>
      </div>
    </div>
  )
}

// ─── Modal éxito ──────────────────────────────────────────────────────────────

function ModalExito({ result, onNew, onReservas }: {
  result: CheckinResult; onNew: () => void; onReservas: () => void
}) {
  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><body style="font-family:sans-serif;padding:20px">
      <h2>Voucher de Check-in</h2>
      <p><b>Habitación:</b> ${result.habitacion_numero}</p>
      <p><b>Huésped:</b> ${result.huesped_nombre}</p>
      <p><b>Código:</b> ${result.codigo_reserva}</p>
      <p><b>Entrada:</b> ${result.fecha_entrada}</p>
      <p><b>Salida:</b> ${result.fecha_salida}</p>
      <p><b>Total:</b> ${formatCurrency(result.total)}</p>
    </body></html>`)
    win.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-bg-card rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-success-bg rounded-full flex items-center justify-center mx-auto text-3xl animate-bounce">✅</div>
        <h2 className="text-xl font-bold text-text-primary">Check-in registrado</h2>
        <div className="space-y-1 text-sm text-text-secondary">
          <p><b>Habitación:</b> {result.habitacion_numero}</p>
          <p><b>Huésped:</b> {result.huesped_nombre}</p>
          <p><b>Código:</b> {result.codigo_reserva}</p>
          <p><b>Check-out:</b> {result.fecha_salida} · 12:00</p>
          <p className="text-xs text-text-tertiary mt-1">Comprobante: enviando...</p>
        </div>
        <div className="space-y-2 pt-2">
          <button onClick={handlePrint} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-bg-secondary">
            🖨️ Imprimir voucher
          </button>
          <button onClick={onNew} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Nuevo check-in
          </button>
          <button onClick={onReservas} className="w-full text-sm text-blue-600 hover:underline">
            Ver todas las reservas
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const initState = (): WizardState => ({
  habitacion: null,
  fecha_entrada:  today,
  numero_noches:  1,
  fecha_salida:   format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  numero_personas: 1,
  precio_por_noche: 0,
  total: 0,
  tipo_documento: 'DNI', numero_documento: '',
  huesped_id: null, nombres: '', apellidos: '', email: '', telefono: '',
  is_returning: false, observaciones: '',
  pagos: [{ metodo: 'EFECTIVO', monto: '', referencia: '' }],
  tipo_comprobante: 'boleta',
  ruc: '', razon_social: '', dir_factura: '', email_factura: '',
  canal_envio: ['whatsapp'],
})

export default function CheckinManualPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [completed, setCompleted] = useState(new Set<number>())
  const [wizard, setWizard] = useState<WizardState>(initState)
  const [result, setResult] = useState<CheckinResult | null>(null)

  const update = useCallback((d: Partial<WizardState>) => setWizard(w => ({ ...w, ...d })), [])

  const goNext = () => {
    setCompleted(c => new Set([...c, step]))
    setStep(s => s + 1)
  }
  const goBack = () => setStep(s => s - 1)

  const handleSuccess = (r: CheckinResult) => {
    setCompleted(new Set([1, 2, 3, 4, 5]))
    setResult(r)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {result && (
        <ModalExito
          result={result}
          onNew={() => { setWizard(initState()); setStep(1); setCompleted(new Set()); setResult(null) }}
          onReservas={() => navigate('/reservas')}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Check-in Manual</h1>
        <p className="text-text-secondary text-sm mt-0.5">Registra el ingreso de un huésped</p>
      </div>

      <StepBar current={step} completed={completed} onGo={setStep} />

      <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm p-6">
        {step === 1 && <Paso1 data={wizard} onUpdate={update} onNext={goNext} />}
        {step === 2 && <Paso2 data={wizard} onUpdate={update} onNext={goNext} onBack={goBack} />}
        {step === 3 && <Paso3 data={wizard} onUpdate={update} onNext={goNext} onBack={goBack} />}
        {step === 4 && <Paso4 data={wizard} onUpdate={update} onNext={goNext} onBack={goBack} />}
        {step === 5 && <Paso5 data={wizard} onBack={goBack} onSuccess={handleSuccess} />}
      </div>
    </div>
  )
}
