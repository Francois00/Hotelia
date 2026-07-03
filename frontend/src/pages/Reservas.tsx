import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import api from '../api/client'
import { tienePermiso } from '../utils/auth'

interface Huesped {
  id: string
  nombre: string
  email: string
  documento?: string
}

interface Habitacion {
  id: string
  numero: string
  tipo: string
  tarifa_base: number
}

interface Reserva {
  id: string
  codigo: string
  huesped_nombre: string
  huesped_email?: string
  habitacion_numero: string
  habitacion_id: string
  fecha_entrada: string
  fecha_salida: string
  num_noches: number
  canal_origen: string
  estado: string
  tarifa_acordada: number
}

interface ReservasResponse {
  data: Reserva[]
  meta: { total: number; page: number; totalPages: number; limit: number }
}

interface FolioItem {
  id: string
  concepto: string
  categoria: string
  cantidad: number
  precio_unitario: number
  total: number
  anulado: boolean
  created_at: string
}

interface Pago {
  id: string
  monto: number
  metodo: string
  created_at: string
}

interface FolioResumen {
  total_cargos: number
  total_pagado: number
  saldo: number
}

interface FolioData {
  items: FolioItem[]
  pagos: Pago[]
}

interface AuditEntry {
  id: string
  accion: string
  campos_modificados: Array<{ campo: string; anterior: string; nuevo: string }> | null
  actor_email: string | null
  motivo: string | null
  created_at: string
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

const CANALES = ['DIRECTO', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB', 'WHATSAPP']
const ESTADOS = ['CONFIRMADA', 'CHECKIN_REALIZADO', 'CHECKOUT_REALIZADO', 'CANCELADA', 'NO_SHOW']

// ─── ModalModificarRegistro ───────────────────────────────────────────────────

function ModalModificarRegistro({ reserva, onClose, onSuccess }: {
  reserva: Reserva
  onClose: () => void
  onSuccess: () => void
}) {
  const gerente = tienePermiso('reservas.modificar_precio')
  const [form, setForm] = useState({
    fecha_entrada: reserva.fecha_entrada.slice(0, 10),
    fecha_salida: reserva.fecha_salida.slice(0, 10),
    canal: reserva.canal_origen,
    tarifa_acordada: reserva.tarifa_acordada,
    notas: '',
    motivo: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.motivo.trim()) { setError('El motivo es obligatorio'); return }
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        fecha_entrada: form.fecha_entrada,
        fecha_salida: form.fecha_salida,
        canal: form.canal,
        notas: form.notas || undefined,
        motivo: form.motivo,
      }
      if (gerente) body.tarifa_acordada = form.tarifa_acordada
      await api.patch(`/api/v1/reservas/${reserva.id}/modificar`, body)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Error al modificar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Modificar reserva</h2>
            <p className="text-sm text-gray-500">{reserva.codigo} · {reserva.huesped_nombre}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha entrada</label>
              <input type="date" value={form.fecha_entrada}
                onChange={e => setForm(f => ({ ...f, fecha_entrada: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha salida</label>
              <input type="date" value={form.fecha_salida}
                onChange={e => setForm(f => ({ ...f, fecha_salida: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
              <select value={form.canal}
                onChange={e => setForm(f => ({ ...f, canal: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CANALES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tarifa acordada (PEN)
                {!gerente && <span className="text-xs text-gray-400 ml-1">(solo gerente)</span>}
              </label>
              <input type="number" value={form.tarifa_acordada}
                onChange={e => setForm(f => ({ ...f, tarifa_acordada: Number(e.target.value) }))}
                disabled={!gerente}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Notas opcionales..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo del cambio <span className="text-red-500">*</span>
            </label>
            <textarea value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
              rows={2} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Describe el motivo del cambio (mínimo 5 caracteres)..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── ModalAnularRegistro ──────────────────────────────────────────────────────

function ModalAnularRegistro({ reserva, onClose, onSuccess }: {
  reserva: Reserva
  onClose: () => void
  onSuccess: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!motivo.trim() || motivo.length < 5) { setError('El motivo debe tener al menos 5 caracteres'); return }
    setSaving(true)
    setError('')
    try {
      // Log the cancellation reason in audit before deleting
      await api.patch(`/api/v1/reservas/${reserva.id}/modificar`, {
        motivo,
        // minimal change to trigger audit record: just the motivo
      })
      await api.delete(`/api/v1/reservas/${reserva.id}`)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Error al anular')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[460px]">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Anular reserva</h2>
            <p className="text-sm text-gray-500">{reserva.codigo} · {reserva.huesped_nombre}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <p className="text-sm text-gray-600">
            Esta acción cambiará el estado de la reserva a <strong>CANCELADA</strong> y liberará la habitación. No se puede deshacer.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de anulación <span className="text-red-500">*</span>
            </label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)}
              rows={3} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Indica el motivo de la anulación (pedido por huésped, error de registro, etc.)..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Anulando...' : 'Confirmar anulación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── NuevaReservaModal ────────────────────────────────────────────────────────

function NuevaReservaModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    huesped_id: '', habitacion_id: '', fecha_entrada: '', fecha_salida: '',
    canal_origen: 'DIRECTO', tarifa_acordada: 0,
  })
  const [huespedQ, setHuespedQ] = useState('')
  const [huespedes, setHuespedes] = useState<Huesped[]>([])
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([])
  const [saving, setSaving] = useState(false)
  const huespedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchHuespedes = useCallback((q: string) => {
    if (huespedTimer.current) clearTimeout(huespedTimer.current)
    if (!q) return
    huespedTimer.current = setTimeout(() => {
      api.get<{ data: Huesped[] }>(`/api/v1/huespedes?nombre=${encodeURIComponent(q)}`)
        .then(r => setHuespedes(r.data.data ?? [])).catch(() => {})
    }, 300)
  }, [])

  useEffect(() => { searchHuespedes(huespedQ) }, [huespedQ, searchHuespedes])

  useEffect(() => {
    if (form.fecha_entrada && form.fecha_salida) {
      api.get<Habitacion[]>(
        `/api/v1/habitaciones/disponibles?fecha_entrada=${form.fecha_entrada}&fecha_salida=${form.fecha_salida}`
      ).then(r => setHabitaciones(r.data)).catch(() => {})
    }
  }, [form.fecha_entrada, form.fecha_salida])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/api/v1/reservas', form)
      onSuccess()
      onClose()
    } catch { /* keep modal open */ } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Nueva reserva</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Huésped</label>
            <input
              type="text"
              value={huespedQ}
              onChange={e => setHuespedQ(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Buscar por nombre..."
            />
            {huespedes.length > 0 && (
              <div className="border border-gray-200 rounded-lg mt-1 shadow-sm max-h-40 overflow-y-auto">
                {huespedes.map(h => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, huesped_id: h.id })); setHuespedQ(h.nombre); setHuespedes([]) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium">{h.nombre}</span>
                    <span className="text-gray-400 ml-2">{h.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha entrada</label>
              <input type="date" value={form.fecha_entrada}
                onChange={e => setForm(f => ({ ...f, fecha_entrada: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha salida</label>
              <input type="date" value={form.fecha_salida}
                onChange={e => setForm(f => ({ ...f, fecha_salida: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Habitación disponible</label>
            <select
              value={form.habitacion_id}
              onChange={e => {
                const h = habitaciones.find(x => x.id === e.target.value)
                setForm(f => ({ ...f, habitacion_id: e.target.value, tarifa_acordada: h?.tarifa_base ?? f.tarifa_acordada }))
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccionar habitación...</option>
              {habitaciones.map(h => (
                <option key={h.id} value={h.id}>
                  Hab. {h.numero} · {h.tipo} · {formatCurrency(h.tarifa_base)}/noche
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
              <select value={form.canal_origen}
                onChange={e => setForm(f => ({ ...f, canal_origen: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CANALES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa acordada (PEN)</label>
              <input type="number" value={form.tarifa_acordada}
                onChange={e => setForm(f => ({ ...f, tarifa_acordada: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Crear reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── ReservaDrawer ────────────────────────────────────────────────────────────

function ReservaDrawer({ reserva, onClose }: { reserva: Reserva; onClose: () => void }) {
  const gerente = tienePermiso('reservas.anular')
  const [folioResumen, setFolioResumen] = useState<FolioResumen | null>(null)
  const [folioData, setFolioData] = useState<FolioData | null>(null)
  const [auditLog, setAuditLog] = useState<AuditEntry[] | null>(null)
  const [drawerTab, setDrawerTab] = useState<'folio' | 'bitacora'>('folio')
  const [qrImg, setQrImg] = useState<string | null>(null)
  const [addCargo, setAddCargo] = useState(false)
  const [addPago, setAddPago] = useState(false)
  const [cargoForm, setCargoForm] = useState({ concepto: '', categoria: 'HABITACION', cantidad: 1, precio_unitario: 0 })
  const [pagoForm, setPagoForm] = useState({ monto: 0, metodo: 'EFECTIVO' })

  useEffect(() => {
    api.get<FolioResumen>(`/api/v1/reservas/${reserva.id}/folio/resumen`)
      .then(r => setFolioResumen(r.data)).catch(() => {})
    api.get<FolioData>(`/api/v1/reservas/${reserva.id}/folio`)
      .then(r => setFolioData(r.data)).catch(() => {})
  }, [reserva.id])

  useEffect(() => {
    if (drawerTab === 'bitacora' && gerente && !auditLog) {
      api.get<AuditEntry[]>(`/api/v1/reservas/${reserva.id}/auditoria`)
        .then(r => setAuditLog(r.data)).catch(() => setAuditLog([]))
    }
  }, [drawerTab, gerente, reserva.id, auditLog])

  const handleVerQR = async () => {
    try {
      const { data } = await api.get<{ qr_base64: string }>(`/api/v1/reservas/${reserva.id}/qr-checkin`)
      setQrImg(data.qr_base64)
    } catch { /* IA not available */ }
  }

  const handleEmitirComprobante = async () => {
    try {
      await api.post('/api/v1/comprobantes/emitir', { reserva_id: reserva.id })
    } catch { /* show nothing */ }
  }

  const handleAddCargo = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post(`/api/v1/reservas/${reserva.id}/folio/items`, cargoForm)
      const r = await api.get<FolioData>(`/api/v1/reservas/${reserva.id}/folio`)
      setFolioData(r.data)
      setAddCargo(false)
    } catch { /* keep form open */ }
  }

  const handleAddPago = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post(`/api/v1/reservas/${reserva.id}/folio/pagos`, pagoForm)
      const [resumen, folio] = await Promise.all([
        api.get<FolioResumen>(`/api/v1/reservas/${reserva.id}/folio/resumen`),
        api.get<FolioData>(`/api/v1/reservas/${reserva.id}/folio`),
      ])
      setFolioResumen(resumen.data)
      setFolioData(folio.data)
      setAddPago(false)
    } catch { /* keep modal open */ }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[480px] bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{reserva.codigo}</h2>
            <p className="text-sm text-gray-500">{reserva.huesped_nombre} · Hab. {reserva.habitacion_numero}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Drawer tabs */}
        {gerente && (
          <div className="flex border-b border-gray-200 shrink-0">
            {(['folio', 'bitacora'] as const).map(t => (
              <button key={t} onClick={() => setDrawerTab(t)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                  drawerTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t === 'folio' ? 'Folio' : 'Bitácora'}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* ── Folio tab ── */}
          {drawerTab === 'folio' && (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Entrada</p>
                  <p className="font-semibold text-gray-900">{format(parseISO(reserva.fecha_entrada), 'dd/MM/yyyy')}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Salida</p>
                  <p className="font-semibold text-gray-900">{format(parseISO(reserva.fecha_salida), 'dd/MM/yyyy')}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Canal</p>
                  <p className="font-semibold text-gray-900">{reserva.canal_origen}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Estado</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadgeClass[reserva.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                    {reserva.estado}
                  </span>
                </div>
              </div>

              {folioResumen && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700">Resumen de folio</h3>
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total cargos</span>
                      <span className="font-medium">{formatCurrency(folioResumen.total_cargos)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total pagado</span>
                      <span className="font-medium text-green-600">{formatCurrency(folioResumen.total_pagado)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-100 pt-2 font-semibold">
                      <span className="text-gray-900">Saldo</span>
                      <span className={folioResumen.saldo > 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(folioResumen.saldo)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {folioData && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Items del folio</h3>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Concepto</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {folioData.items.map(item => (
                          <tr key={item.id} className={item.anulado ? 'opacity-40' : ''}>
                            <td className={`px-3 py-2 ${item.anulado ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {item.concepto}
                              <span className="text-gray-400 text-xs ml-1">{item.cantidad}x {formatCurrency(item.precio_unitario)}</span>
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900">
                              {formatCurrency(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {addCargo && (
                <form onSubmit={handleAddCargo} className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-blue-800">Agregar cargo</h4>
                  <input placeholder="Concepto" value={cargoForm.concepto}
                    onChange={e => setCargoForm(f => ({ ...f, concepto: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" required />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="Cantidad" value={cargoForm.cantidad}
                      onChange={e => setCargoForm(f => ({ ...f, cantidad: Number(e.target.value) }))}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                    <input type="number" placeholder="Precio unitario" value={cargoForm.precio_unitario}
                      onChange={e => setCargoForm(f => ({ ...f, precio_unitario: Number(e.target.value) }))}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddCargo(false)} className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700">Cancelar</button>
                    <button type="submit" className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium">Agregar</button>
                  </div>
                </form>
              )}

              {addPago && (
                <form onSubmit={handleAddPago} className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-green-800">Registrar pago</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="Monto" value={pagoForm.monto}
                      onChange={e => setPagoForm(f => ({ ...f, monto: Number(e.target.value) }))}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" required />
                    <select value={pagoForm.metodo}
                      onChange={e => setPagoForm(f => ({ ...f, metodo: e.target.value }))}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                      {['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddPago(false)} className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700">Cancelar</button>
                    <button type="submit" className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium">Registrar</button>
                  </div>
                </form>
              )}

              {qrImg && (
                <div className="text-center">
                  <img src={`data:image/png;base64,${qrImg}`} alt="QR check-in" className="mx-auto w-32 h-32 rounded-xl border border-gray-200" />
                  <p className="text-xs text-gray-500 mt-1">QR de check-in</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setAddCargo(v => !v)} className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  + Agregar cargo
                </button>
                <button onClick={() => setAddPago(v => !v)} className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  + Registrar pago
                </button>
                <button onClick={() => void handleVerQR()} className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Ver QR
                </button>
                <button onClick={() => void handleEmitirComprobante()} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Emitir comprobante
                </button>
              </div>
            </div>
          )}

          {/* ── Bitácora tab (gerente only) ── */}
          {drawerTab === 'bitacora' && gerente && (
            <div className="p-6 space-y-3">
              <p className="text-xs text-gray-400">Registro de cambios de esta reserva</p>
              {!auditLog && (
                <p className="text-sm text-gray-400">Cargando...</p>
              )}
              {auditLog && auditLog.length === 0 && (
                <p className="text-sm text-gray-400">Sin cambios registrados</p>
              )}
              {auditLog && auditLog.map(entry => (
                <div key={entry.id} className="rounded-xl border border-gray-200 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{entry.accion}</span>
                    <span className="text-xs text-gray-400">{format(parseISO(entry.created_at), 'dd/MM/yy HH:mm')}</span>
                  </div>
                  {entry.actor_email && (
                    <p className="text-xs text-gray-500">Por: {entry.actor_email}</p>
                  )}
                  {entry.motivo && (
                    <p className="text-sm text-gray-700 italic">"{entry.motivo}"</p>
                  )}
                  {entry.campos_modificados && entry.campos_modificados.length > 0 && (
                    <table className="w-full text-xs mt-1">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-left font-medium pb-1">Campo</th>
                          <th className="text-left font-medium pb-1">Anterior</th>
                          <th className="text-left font-medium pb-1">Nuevo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {entry.campos_modificados.map((c, i) => (
                          <tr key={i}>
                            <td className="py-1 text-gray-600 font-medium">{c.campo}</td>
                            <td className="py-1 text-red-500 line-through">{c.anterior}</td>
                            <td className="py-1 text-green-600">{c.nuevo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Reservas() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null)
  const [showNueva, setShowNueva] = useState(false)
  const [modificarReserva, setModificarReserva] = useState<Reserva | null>(null)
  const [anularReserva, setAnularReserva] = useState<Reserva | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gerente = tienePermiso('reservas.anular')
  const puedeCheckin = tienePermiso('checkin.ejecutar')

  const q = searchParams.get('q') ?? ''
  const estado = searchParams.get('estado') ?? ''
  const canal_origen = searchParams.get('canal_origen') ?? ''
  const fecha_entrada = searchParams.get('fecha_entrada') ?? ''
  const fecha_salida = searchParams.get('fecha_salida') ?? ''
  const page = Number(searchParams.get('page') ?? '1')
  const tab = (searchParams.get('tab') ?? 'activos') as 'activos' | 'todos' | 'historico'

  const buildParams = useCallback((overrides: Record<string, string> = {}) => {
    const p: Record<string, string> = { limit: '20', page: String(page) }
    if (q) {
      if (/^[A-Z]{2,3}-\d+/i.test(q)) p['codigo'] = q
      else p['huesped_nombre'] = q
    }
    if (estado) p['estado'] = estado
    else if (tab !== 'todos') p['tab'] = tab
    if (canal_origen) p['canal_origen'] = canal_origen
    if (fecha_entrada) p['fecha_entrada'] = fecha_entrada
    if (fecha_salida) p['fecha_salida'] = fecha_salida
    return { ...p, ...overrides }
  }, [q, estado, canal_origen, fecha_entrada, fecha_salida, page, tab])

  const { data } = useQuery<ReservasResponse>({
    queryKey: ['reservas', q, estado, canal_origen, fecha_entrada, fecha_salida, page, tab],
    queryFn: () => {
      const params = new URLSearchParams(buildParams())
      return api.get<ReservasResponse>(`/api/v1/reservas?${params}`).then(r => r.data)
    },
    refetchInterval: 30000,
  })

  const reservas = data?.data ?? []
  const meta = data?.meta

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const setTab = (t: string) => {
    const p = new URLSearchParams(searchParams)
    p.set('tab', t)
    p.set('page', '1')
    setSearchParams(p)
  }

  const updateParam = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams)
    if (!value) p.delete(key)
    else { p.set(key, value); p.set('page', '1') }
    setSearchParams(p)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => updateParam('q', v), 400)
  }

  const handleExportCSV = async () => {
    const params = new URLSearchParams(buildParams({ limit: '10000', page: '1' }))
    try {
      const { data: allData } = await api.get<ReservasResponse>(`/api/v1/reservas?${params}`)
      const rows = allData.data
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const header = 'Código,Huésped,Email,Habitación,Entrada,Salida,Noches,Canal,Estado,Total'
      const csv = [header, ...rows.map(r =>
        [r.codigo, r.huesped_nombre, r.huesped_email ?? '',
         r.habitacion_numero, r.fecha_entrada, r.fecha_salida,
         r.num_noches, r.canal_origen, r.estado,
         r.tarifa_acordada].join(',')
      )].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reservas-${todayStr}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silent */ }
  }

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(p))
    setSearchParams(params)
  }

  const TABS = [
    { id: 'activos', label: 'Activos' },
    { id: 'todos', label: 'Todos' },
    { id: 'historico', label: 'Histórico' },
  ]

  return (
    <div className="p-6 space-y-5">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-gray-900 text-white rounded-xl shadow-xl text-sm font-medium">{toast}</div>
      )}
      {selectedReserva && (
        <ReservaDrawer reserva={selectedReserva} onClose={() => setSelectedReserva(null)} />
      )}
      {showNueva && (
        <NuevaReservaModal
          onClose={() => setShowNueva(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['reservas'] })
            setToast('Reserva creada exitosamente')
          }}
        />
      )}
      {modificarReserva && (
        <ModalModificarRegistro
          reserva={modificarReserva}
          onClose={() => setModificarReserva(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['reservas'] })
            setToast('Reserva modificada')
          }}
        />
      )}
      {anularReserva && (
        <ModalAnularRegistro
          reserva={anularReserva}
          onClose={() => setAnularReserva(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['reservas'] })
            setToast('Reserva anulada')
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-gray-500 text-sm mt-0.5">{meta?.total ?? 0} reservas encontradas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void handleExportCSV()}
            className="px-4 py-2 text-sm border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium">
            Exportar CSV
          </button>
          {puedeCheckin && (
            <button onClick={() => setShowNueva(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
              + Nueva reserva
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <input
          type="text"
          defaultValue={q}
          onChange={handleSearchChange}
          placeholder="Buscar por huésped o código..."
          className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={estado} onChange={e => updateParam('estado', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={canal_origen} onChange={e => updateParam('canal_origen', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los canales</option>
          {['DIRECTO', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB', 'WHATSAPP'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={fecha_entrada} onChange={e => updateParam('fecha_entrada', e.target.value)}
          placeholder="Desde"
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={fecha_salida} onChange={e => updateParam('fecha_salida', e.target.value)}
          placeholder="Hasta"
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Código', 'Huésped', 'Habitación', 'Entrada', 'Salida', 'Noches', 'Canal', 'Total', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reservas.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">Sin reservas</td></tr>
              )}
              {reservas.map(r => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedReserva(r)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.codigo}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.huesped_nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{r.habitacion_numero}</td>
                  <td className="px-4 py-3 text-gray-600">{format(parseISO(r.fecha_entrada), 'dd/MM/yy')}</td>
                  <td className="px-4 py-3 text-gray-600">{format(parseISO(r.fecha_salida), 'dd/MM/yy')}</td>
                  <td className="px-4 py-3 text-gray-600 text-center">{r.num_noches}</td>
                  <td className="px-4 py-3 text-gray-600">{r.canal_origen}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(r.tarifa_acordada)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadgeClass[r.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      {r.estado === 'CHECKIN_REALIZADO' && (
                        <button
                          onClick={() => navigate(`/checkout/${r.id}`)}
                          className="px-2.5 py-1 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 whitespace-nowrap"
                        >
                          Checkout
                        </button>
                      )}
                      {r.estado === 'CONFIRMADA' && puedeCheckin && (
                        <button
                          onClick={() => setModificarReserva(r)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          Modificar
                        </button>
                      )}
                      {r.estado === 'CONFIRMADA' && gerente && (
                        <button
                          onClick={() => setAnularReserva(r)}
                          className="px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="px-4 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Mostrando {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} de {meta.total}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={meta.page <= 1}
                onClick={() => setPage(meta.page - 1)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="px-3 py-1.5 text-xs text-gray-500">Pág. {meta.page} / {meta.totalPages}</span>
              <button
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage(meta.page + 1)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
