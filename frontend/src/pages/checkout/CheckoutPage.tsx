import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import api from '../../api/client'
import ModalCheckoutExitoso from '../../components/checkout/ModalCheckoutExitoso'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Huesped {
  id: string; nombre: string; apellido: string
  tipo_documento: string; numero_documento: string; telefono?: string | null
}

interface Habitacion {
  id: string; numero: string; tipo: string; piso: number
}

interface ReservaDetalle {
  id: string; codigo: string; estado: string
  fecha_entrada: string; fecha_salida: string
  tarifa_acordada: number; adultos: number; ninos: number
  tipo_comprobante?: string | null; datos_facturacion?: Record<string, string> | null
  huesped: Huesped; habitacion: Habitacion
}

interface FolioItem {
  id: string; descripcion?: string; concepto?: string
  tipo?: string; categoria?: string
  cantidad: number; precio_unitario: number; total: number
  anulado: boolean; created_at: string
}

interface Pago {
  id: string; monto: number; metodo: string
  referencia_externa?: string | null; created_at: string
}

interface FolioData { items: FolioItem[]; pagos: Pago[] }

interface PagoNuevo { metodo: string; monto: string; referencia: string }

interface CheckoutResult {
  reservaId: string; habitacionNumero: string; huespedNombre: string
  noches: number; total: number; tipoComprobante: string
  comprobante?: { tipo: string; serie: string; correlativo: string; pdf_url?: string | null } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METODOS_PAGO = [
  { value: 'EFECTIVO', label: '💵 Efectivo' },
  { value: 'YAPE', label: '📱 Yape' },
  { value: 'PLIN', label: '📱 Plin' },
  { value: 'TARJETA_DEBITO', label: '💳 Débito' },
  { value: 'TARJETA_CREDITO', label: '💳 Crédito' },
  { value: 'TRANSFERENCIA', label: '🏦 Transferencia' },
]

const TIPOS_CARGO = ['HABITACION', 'SERVICIO', 'MINIBAR', 'RESTAURANTE', 'LAVANDERIA', 'OTRO']

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)

const getLabel = (item: FolioItem) => item.descripcion ?? item.concepto ?? '—'

// ─── Step bar ─────────────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  const steps = ['Folio y cargos', 'Pago pendiente', 'Comprobante']
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => {
        const n = i + 1
        const done = current > n
        const active = current === n
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-text-secondary'
              }`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${active ? 'text-text-primary' : 'text-text-tertiary'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${current > n ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { reservaId } = useParams<{ reservaId: string }>()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [cargoForm, setCargoForm] = useState({ descripcion: '', monto: '', tipo: 'SERVICIO' })
  const [addingCargo, setAddingCargo] = useState(false)
  const [savingCargo, setSavingCargo] = useState(false)
  const [pagosNuevos, setPagosNuevos] = useState<PagoNuevo[]>([{ metodo: 'EFECTIVO', monto: '', referencia: '' }])
  const [savingPagos, setSavingPagos] = useState(false)
  const [tipoComprobante, setTipoComprobante] = useState<'BOLETA' | 'FACTURA'>('BOLETA')
  const [datosFacturacion, setDatosFacturacion] = useState({ ruc: '', razon_social: '', direccion: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CheckoutResult | null>(null)

  const { data: reserva, isLoading: loadingReserva } = useQuery<ReservaDetalle>({
    queryKey: ['reserva-detail', reservaId],
    queryFn: () => api.get<ReservaDetalle>(`/api/v1/reservas/${reservaId}`).then(r => r.data),
    enabled: !!reservaId,
  })

  const { data: folio, isLoading: loadingFolio, refetch: refetchFolio } = useQuery<FolioData>({
    queryKey: ['folio-detail', reservaId],
    queryFn: () => api.get<FolioData>(`/api/v1/reservas/${reservaId}/folio`).then(r => r.data),
    enabled: !!reservaId,
  })

  const items = folio?.items ?? []
  const pagos = folio?.pagos ?? []
  const totalCargos = items.filter(i => !i.anulado).reduce((s, i) => s + (i.total ?? i.precio_unitario * i.cantidad), 0)
  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0)
  const saldoPendiente = Math.max(0, totalCargos - totalPagado)

  const noches = reserva
    ? Math.max(1, differenceInCalendarDays(parseISO(reserva.fecha_salida), parseISO(reserva.fecha_entrada)))
    : 0

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleAddCargo = async () => {
    if (!cargoForm.descripcion || !cargoForm.monto || !reservaId) return
    setSavingCargo(true)
    try {
      await api.post(`/api/v1/reservas/${reservaId}/folio/items`, {
        descripcion: cargoForm.descripcion,
        tipo: cargoForm.tipo,
        cantidad: 1,
        precio_unitario: parseFloat(cargoForm.monto),
      })
      setCargoForm({ descripcion: '', monto: '', tipo: 'SERVICIO' })
      setAddingCargo(false)
      await refetchFolio()
    } catch { /* keep form */ } finally { setSavingCargo(false) }
  }

  const sumNuevosPagos = pagosNuevos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)

  const handleConfirmarPagos = async () => {
    if (!reservaId) return
    setSavingPagos(true)
    setError('')
    try {
      for (const p of pagosNuevos) {
        const monto = parseFloat(p.monto) || 0
        if (monto <= 0) continue
        await api.post(`/api/v1/reservas/${reservaId}/folio/pagos`, {
          metodo: p.metodo,
          monto,
          referencia_externa: p.referencia || undefined,
        })
      }
      await refetchFolio()
      setStep(3)
    } catch {
      setError('Error al registrar los pagos. Intenta nuevamente.')
    } finally { setSavingPagos(false) }
  }

  const handleConfirmarCheckout = async () => {
    if (!reservaId || !reserva) return
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        estado: 'CHECKOUT_REALIZADO',
        tipo_comprobante: tipoComprobante,
      }
      if (tipoComprobante === 'FACTURA') {
        body.datos_facturacion = datosFacturacion
      }

      await api.patch(`/api/v1/reservas/${reservaId}/estado`, body)

      let comprobante = null
      try {
        const comp = await api.get(`/api/v1/comprobantes/reserva/${reservaId}`)
        comprobante = comp.data
      } catch { /* comprobante might not be ready yet */ }

      setResult({
        reservaId,
        habitacionNumero: reserva.habitacion.numero,
        huespedNombre: `${reserva.huesped.nombre} ${reserva.huesped.apellido}`,
        noches,
        total: totalCargos,
        tipoComprobante,
        comprobante,
      })
    } catch (e: unknown) {
      const code = (e as { response?: { data?: { code?: string; details?: { saldo?: number } } } })?.response?.data
      if (code?.code === 'FOLIO_CON_SALDO_PENDIENTE') {
        setError(`Hay un saldo pendiente de ${formatCurrency(code.details?.saldo ?? 0)}. Vuelve al paso anterior.`)
      } else if (code?.code === 'RESERVA_NO_EN_CHECKIN') {
        setError('Solo se puede hacer checkout de reservas en estado check-in.')
      } else if (code?.code === 'SUNAT_NO_DISPONIBLE') {
        // Checkout went through, but comprobante is queued
        setResult({
          reservaId,
          habitacionNumero: reserva.habitacion.numero,
          huespedNombre: `${reserva.huesped.nombre} ${reserva.huesped.apellido}`,
          noches,
          total: totalCargos,
          tipoComprobante,
          comprobante: null,
        })
      } else {
        setError('Error al procesar el checkout. Intenta nuevamente.')
      }
    } finally { setSaving(false) }
  }

  // ─── Loading / Error states ──────────────────────────────────────────────

  if (loadingReserva || loadingFolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!reserva) {
    return (
      <div className="p-6 text-center text-text-secondary">
        Reserva no encontrada.
        <button onClick={() => navigate('/reservas')} className="block mx-auto mt-3 text-blue-600 text-sm underline">
          Volver a reservas
        </button>
      </div>
    )
  }

  if (reserva.estado !== 'CHECKIN_REALIZADO') {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto text-2xl">⚠️</div>
        <p className="text-gray-700 font-medium">Esta reserva no está en estado Check-in</p>
        <p className="text-text-secondary text-sm">Estado actual: <strong>{reserva.estado}</strong></p>
        <button onClick={() => navigate('/reservas')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Volver a reservas
        </button>
      </div>
    )
  }

  // ─── Success modal ───────────────────────────────────────────────────────

  if (result) {
    return (
      <ModalCheckoutExitoso
        reservaId={result.reservaId}
        habitacionNumero={result.habitacionNumero}
        huespedNombre={result.huespedNombre}
        noches={result.noches}
        total={result.total}
        tipoComprobante={result.tipoComprobante}
        comprobante={result.comprobante}
      />
    )
  }

  // ─── Reservation info card (persistent) ─────────────────────────────────

  const InfoCard = () => (
    <div className="bg-info-bg border border-info rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="font-bold text-info">Hab. {reserva.habitacion.numero}</span>
      <span className="text-info">{reserva.habitacion.tipo}</span>
      <span className="text-blue-600">·</span>
      <span className="font-medium text-info">{reserva.huesped.nombre} {reserva.huesped.apellido}</span>
      <span className="text-blue-600">·</span>
      <span className="text-info">{noches} noches</span>
      <span className="text-blue-600">·</span>
      <span className="text-info">
        {format(parseISO(reserva.fecha_entrada), 'dd/MM/yy')} → {format(parseISO(reserva.fecha_salida), 'dd/MM/yy')}
      </span>
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Checkout</h1>
        <p className="text-sm text-text-secondary mt-0.5">{reserva.codigo}</p>
      </div>

      <StepBar current={step} />
      <InfoCard />

      {error && (
        <div className="bg-danger-bg border border-danger rounded-xl px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* ─── STEP 1: Folio y cargos ─────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Folio items */}
          <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border-primary flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Cargos de la estancia</h2>
              <button
                onClick={() => setAddingCargo(v => !v)}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-bg-secondary"
              >
                + Agregar cargo
              </button>
            </div>

            {addingCargo && (
              <div className="px-5 py-4 bg-info-bg border-b border-info space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={cargoForm.descripcion}
                    onChange={e => setCargoForm(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Descripción del cargo"
                    className="sm:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-xs">S/</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={cargoForm.monto}
                      onChange={e => setCargoForm(f => ({ ...f, monto: e.target.value }))}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={cargoForm.tipo}
                    onChange={e => setCargoForm(f => ({ ...f, tipo: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIPOS_CARGO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAddingCargo(false)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-bg-card">
                    Cancelar
                  </button>
                  <button
                    onClick={() => void handleAddCargo()}
                    disabled={savingCargo || !cargoForm.descripcion || !cargoForm.monto}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingCargo ? 'Agregando...' : 'Agregar cargo'}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-secondary text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-text-secondary">Descripción</th>
                    <th className="px-4 py-2 text-left font-semibold text-text-secondary">Tipo</th>
                    <th className="px-4 py-2 text-right font-semibold text-text-secondary">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-text-tertiary">Sin cargos registrados</td></tr>
                  ) : items.map(item => (
                    <tr key={item.id} className={item.anulado ? 'opacity-40' : ''}>
                      <td className={`px-4 py-2.5 ${item.anulado ? 'line-through text-text-tertiary' : 'text-gray-800'}`}>
                        {getLabel(item)}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary text-xs">{item.tipo ?? item.categoria ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-text-primary">
                        {formatCurrency(item.total ?? item.precio_unitario * item.cantidad)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border-primary bg-bg-secondary">
                  <tr>
                    <td colSpan={2} className="px-4 py-2.5 text-sm font-semibold text-gray-700">Subtotal cargos</td>
                    <td className="px-4 py-2.5 text-right font-bold text-text-primary">{formatCurrency(totalCargos)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Pagos ya registrados */}
          <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Pagos registrados</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-secondary text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-text-secondary">Método</th>
                    <th className="px-4 py-2 text-left font-semibold text-text-secondary">Referencia</th>
                    <th className="px-4 py-2 text-right font-semibold text-text-secondary">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagos.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-text-tertiary">Sin pagos registrados</td></tr>
                  ) : pagos.map(p => (
                    <tr key={p.id}>
                      <td className="px-4 py-2.5 text-gray-700">{p.metodo}</td>
                      <td className="px-4 py-2.5 text-text-secondary text-xs">{p.referencia_externa ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-success">{formatCurrency(Number(p.monto))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border-primary bg-bg-secondary">
                  <tr>
                    <td colSpan={2} className="px-4 py-2.5 text-sm font-semibold text-gray-700">Total pagado</td>
                    <td className="px-4 py-2.5 text-right font-bold text-success">{formatCurrency(totalPagado)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Saldo */}
          <div className={`rounded-xl border px-5 py-4 flex items-center justify-between ${
            saldoPendiente > 0 ? 'border-danger bg-danger-bg' : 'border-success bg-success-bg'
          }`}>
            <div>
              <p className="text-sm font-semibold text-gray-700">Saldo pendiente</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {saldoPendiente > 0 ? 'Debe cobrarse antes del checkout' : 'Todo pagado ✓'}
              </p>
            </div>
            <p className={`text-xl font-bold ${saldoPendiente > 0 ? 'text-red-600' : 'text-success'}`}>
              {formatCurrency(saldoPendiente)}
            </p>
          </div>

          <div className="flex justify-between">
            <button onClick={() => navigate('/reservas')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-bg-secondary">
              ← Cancelar
            </button>
            <button
              onClick={() => saldoPendiente > 0 ? setStep(2) : setStep(3)}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              {saldoPendiente > 0 ? 'Continuar — Cobrar saldo →' : 'Continuar →'}
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Pago pendiente ──────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-orange-800">Saldo a cobrar</p>
            <p className="text-xl font-bold text-orange-700">{formatCurrency(saldoPendiente)}</p>
          </div>

          <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">Métodos de pago</h2>

            <div className="space-y-3">
              {pagosNuevos.map((p, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <select
                    value={p.metodo}
                    onChange={e => setPagosNuevos(prev => prev.map((x, j) => j === i ? { ...x, metodo: e.target.value } : x))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-bg-card w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-xs">S/</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={p.monto}
                      onChange={e => setPagosNuevos(prev => prev.map((x, j) => j === i ? { ...x, monto: e.target.value } : x))}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={p.referencia}
                    onChange={e => setPagosNuevos(prev => prev.map((x, j) => j === i ? { ...x, referencia: e.target.value } : x))}
                    placeholder="Referencia (opc.)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {pagosNuevos.length > 1 && (
                    <button
                      onClick={() => setPagosNuevos(prev => prev.filter((_, j) => j !== i))}
                      className="mt-0.5 text-text-tertiary hover:text-red-500 text-lg leading-none px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setPagosNuevos(prev => [...prev, { metodo: 'EFECTIVO', monto: '', referencia: '' }])}
              className="text-sm text-blue-600 hover:underline"
            >
              + Agregar otro método
            </button>

            {/* Efectivo vuelto */}
            {pagosNuevos.some(p => p.metodo === 'EFECTIVO') && sumNuevosPagos > saldoPendiente && (
              <div className="bg-success-bg border border-success rounded-lg px-4 py-3 flex justify-between text-sm">
                <span className="text-success font-medium">Vuelto a dar</span>
                <span className="font-bold text-success">{formatCurrency(sumNuevosPagos - saldoPendiente)}</span>
              </div>
            )}

            {/* Totals summary */}
            <div className="border-t border-border-primary pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Saldo pendiente</span>
                <span>{formatCurrency(saldoPendiente)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Total a cobrar ahora</span>
                <span className={sumNuevosPagos >= saldoPendiente ? 'text-success font-medium' : 'text-red-500 font-medium'}>
                  {formatCurrency(sumNuevosPagos)}
                </span>
              </div>
            </div>

            {sumNuevosPagos > saldoPendiente + 0.01 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-800">
                ⚠️ Estás cobrando {formatCurrency(sumNuevosPagos - saldoPendiente)} de más. El exceso quedará como adelanto en el folio.
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-bg-secondary">
              ← Volver
            </button>
            <button
              onClick={() => void handleConfirmarPagos()}
              disabled={savingPagos || sumNuevosPagos < saldoPendiente - 0.01}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {savingPagos ? 'Registrando...' : 'Registrar pagos →'}
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Comprobante y confirmación ─────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Resumen final */}
          <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Resumen del checkout</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Habitación</span>
                <span className="font-medium">Hab. {reserva.habitacion.numero} — {reserva.habitacion.tipo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Huésped</span>
                <span className="font-medium">{reserva.huesped.nombre} {reserva.huesped.apellido}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Tipo doc.</span>
                <span className="text-gray-700">{reserva.huesped.tipo_documento}: {reserva.huesped.numero_documento}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Entrada</span>
                <span className="text-gray-700">{format(parseISO(reserva.fecha_entrada), 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Salida</span>
                <span className="text-gray-700">{format(parseISO(reserva.fecha_salida), 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Estadía</span>
                <span className="text-gray-700">{noches} noches</span>
              </div>
              <div className="border-t border-border-primary pt-2.5 flex justify-between">
                <span className="text-text-secondary">Total cargos</span>
                <span className="font-semibold">{formatCurrency(totalCargos)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Total pagado</span>
                <span className="font-semibold text-success">{formatCurrency(totalPagado)}</span>
              </div>
              <div className="flex justify-between text-success">
                <span className="font-medium">Saldo</span>
                <span className="font-bold">S/ 0.00 ✅</span>
              </div>
            </div>
          </div>

          {/* Comprobante */}
          <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">Tipo de comprobante</h2>

            <div className="flex gap-4">
              {(['BOLETA', 'FACTURA'] as const).map(tipo => (
                <label key={tipo} className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                  tipoComprobante === tipo ? 'border-blue-500 bg-info-bg' : 'border-border-primary hover:border-gray-300'
                }`}>
                  <input type="radio" name="tipo_comprobante" value={tipo}
                    checked={tipoComprobante === tipo}
                    onChange={() => setTipoComprobante(tipo)}
                    className="accent-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{tipo === 'BOLETA' ? 'Boleta de venta' : 'Factura electrónica'}</p>
                    <p className="text-xs text-text-secondary">{tipo === 'BOLETA' ? 'Para personas naturales' : 'Para empresas con RUC'}</p>
                  </div>
                </label>
              ))}
            </div>

            {tipoComprobante === 'FACTURA' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">RUC</label>
                  <input type="text" maxLength={11}
                    value={datosFacturacion.ruc}
                    onChange={e => setDatosFacturacion(f => ({ ...f, ruc: e.target.value }))}
                    placeholder="20xxxxxxxxx"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Razón social</label>
                  <input type="text"
                    value={datosFacturacion.razon_social}
                    onChange={e => setDatosFacturacion(f => ({ ...f, razon_social: e.target.value }))}
                    placeholder="Empresa S.A.C."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Dirección fiscal</label>
                  <input type="text"
                    value={datosFacturacion.direccion}
                    onChange={e => setDatosFacturacion(f => ({ ...f, direccion: e.target.value }))}
                    placeholder="Av. Ejemplo 123, Lima"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Email empresa</label>
                  <input type="email"
                    value={datosFacturacion.email}
                    onChange={e => setDatosFacturacion(f => ({ ...f, email: e.target.value }))}
                    placeholder="contabilidad@empresa.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => { setStep(saldoPendiente > 0 ? 2 : 1) }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-bg-secondary"
            >
              ← Volver
            </button>
            <button
              onClick={() => void handleConfirmarCheckout()}
              disabled={saving || (tipoComprobante === 'FACTURA' && (!datosFacturacion.ruc || !datosFacturacion.razon_social))}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Procesando...</>
              ) : (
                '✅ Confirmar Checkout'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
