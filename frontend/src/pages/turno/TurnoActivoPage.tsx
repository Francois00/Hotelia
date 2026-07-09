import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import CerrarTurnoModal from '../../components/turno/CerrarTurnoModal'
import AbrirTurnoModal from '../../components/turno/AbrirTurnoModal'

interface TurnoData {
  turno: {
    id: string; tipo: string; hora_apertura: string; saldo_inicial: number
    recepcionista: { nombre: string; apellido: string }
  }
  resumen: {
    total_checkins: number; total_checkouts: number
    total_efectivo: number; total_yape: number; total_plin: number
    total_tarjetas: number; total_transferencias: number
    total_general: number; total_gastos_caja: number
    efectivo_neto: number; saldo_final_proyectado: number
  }
}

interface Gasto {
  id: string; concepto: string; monto: number
  comprobante_proveedor?: string | null; created_at: string
  registrado_por?: { nombre: string }
}

interface Transaccion {
  id: string; created_at: string
  huesped?: { nombre: string; apellido: string } | null
  habitacion?: { numero: string } | null
  metodo: string; monto: number
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })

export default function TurnoActivoPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCerrar, setShowCerrar] = useState(false)
  const [showAbrir, setShowAbrir] = useState(false)
  const [gastoForm, setGastoForm] = useState({ concepto: '', monto: '', comprobante: '' })
  const [savingGasto, setSavingGasto] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const { data, isLoading } = useQuery<TurnoData | null>({
    queryKey: ['turno-activo-page'],
    queryFn: () => api.get<TurnoData>('/api/v1/turnos/activo').then(r => r.data).catch(() => null),
    refetchInterval: 30000,
  })

  const { data: gastos = [], refetch: refetchGastos } = useQuery<Gasto[]>({
    queryKey: ['turno-gastos', data?.turno.id],
    queryFn: () => data?.turno.id
      ? api.get<Gasto[]>(`/api/v1/turnos/${data.turno.id}/gastos`).then(r => Array.isArray(r.data) ? r.data : [])
      : Promise.resolve([]),
    enabled: !!data?.turno.id,
    refetchInterval: 60000,
  })

  const { data: transacciones = [] } = useQuery<Transaccion[]>({
    queryKey: ['turno-transacciones', data?.turno.id],
    queryFn: () => data?.turno.id
      ? api.get<{ data: Transaccion[] }>(`/api/v1/reservas?turno_id=${data.turno.id}&limit=50`)
          .then(r => Array.isArray(r.data) ? r.data : (r.data.data ?? []))
          .catch(() => [])
      : Promise.resolve([]),
    enabled: !!data?.turno.id,
  })

  const handleRegistrarGasto = async () => {
    if (!gastoForm.concepto || !gastoForm.monto || !data?.turno.id) return
    setSavingGasto(true)
    try {
      await api.post(`/api/v1/turnos/${data.turno.id}/gastos`, {
        concepto: gastoForm.concepto,
        monto: parseFloat(gastoForm.monto),
        comprobante_proveedor: gastoForm.comprobante || null,
      })
      setGastoForm({ concepto: '', monto: '', comprobante: '' })
      await refetchGastos()
      showToast('Gasto registrado')
    } catch { /* silencioso */ }
    finally { setSavingGasto(false) }
  }

  const handleCerrado = () => {
    void queryClient.invalidateQueries({ queryKey: ['turno-activo-page'] })
    void queryClient.invalidateQueries({ queryKey: ['turno-activo-widget'] })
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  if (!data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-4">
        {showAbrir && (
          <AbrirTurnoModal
            onClose={() => setShowAbrir(false)}
            onOpened={() => {
              setShowAbrir(false)
              void queryClient.invalidateQueries({ queryKey: ['turno-activo-page'] })
              void queryClient.invalidateQueries({ queryKey: ['turno-activo-widget'] })
            }}
          />
        )}
        <p className="text-text-secondary text-sm">No hay un turno abierto.</p>
        <button
          onClick={() => setShowAbrir(true)}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Abrir turno
        </button>
        <button onClick={() => navigate('/dashboard')} className="text-sm text-text-tertiary hover:underline">
          Ir al Dashboard
        </button>
      </div>
    )
  }

  const { turno, resumen } = data

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-gray-900 text-white rounded-xl shadow-xl text-sm font-medium">
          {toast}
        </div>
      )}
      {showCerrar && (
        <CerrarTurnoModal
          turnoId={turno.id}
          turnoTipo={turno.tipo}
          resumen={resumen}
          onClose={() => setShowCerrar(false)}
          onCerrado={handleCerrado}
        />
      )}

      {/* Header */}
      <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          <div>
            <h1 className="text-lg font-bold text-text-primary">TURNO {turno.tipo}</h1>
            <p className="text-sm text-text-secondary">
              Apertura: {new Date(turno.hora_apertura).toLocaleDateString('es-PE')} {hora(turno.hora_apertura)} · {turno.recepcionista.nombre} {turno.recepcionista.apellido}
            </p>
          </div>
        </div>
        <button onClick={() => setShowCerrar(true)}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">
          Cerrar turno
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Transacciones */}
        <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border-primary">
            <h2 className="text-sm font-semibold text-text-primary">Movimientos del turno</h2>
          </div>
          <div className="overflow-y-auto max-h-96">
            {transacciones.length === 0 ? (
              <p className="text-center text-sm text-text-tertiary py-8">Sin movimientos aún</p>
            ) : (
              <table className="w-full">
                <thead className="bg-bg-secondary">
                  <tr>
                    {['Hora', 'Cliente', 'Hab.', 'Método', 'Monto'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transacciones.map(t => (
                    <tr key={t.id} className="hover:bg-bg-secondary">
                      <td className="px-3 py-2 text-xs text-text-secondary">{hora(t.created_at)}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 max-w-20 truncate">
                        {t.huesped ? `${t.huesped.nombre} ${t.huesped.apellido[0]}.` : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">{t.habitacion?.numero ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-text-secondary">{t.metodo}</td>
                      <td className="px-3 py-2 text-xs font-medium text-text-primary">{formatCurrency(t.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Gastos */}
        <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border-primary">
            <h2 className="text-sm font-semibold text-text-primary">Gastos de caja</h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="space-y-2">
              <input type="text" value={gastoForm.concepto} onChange={e => setGastoForm(f => ({ ...f, concepto: e.target.value }))}
                placeholder="Concepto (ej: Compra de papel)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-xs">S/</span>
                <input type="number" step="0.01" min={0} value={gastoForm.monto} onChange={e => setGastoForm(f => ({ ...f, monto: e.target.value }))}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <input type="text" value={gastoForm.comprobante} onChange={e => setGastoForm(f => ({ ...f, comprobante: e.target.value }))}
                placeholder="Nro. factura del proveedor (opcional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => void handleRegistrarGasto()} disabled={savingGasto || !gastoForm.concepto || !gastoForm.monto}
                className="w-full py-2 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50">
                + Registrar gasto
              </button>
            </div>
            <div className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
              {gastos.map(g => (
                <div key={g.id} className="py-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-gray-800">{g.concepto}</p>
                    <p className="text-xs text-text-tertiary">{hora(g.created_at)}{g.comprobante_proveedor ? ` · ${g.comprobante_proveedor}` : ''}</p>
                  </div>
                  <span className="text-xs font-semibold text-red-500 whitespace-nowrap">{formatCurrency(g.monto)}</span>
                </div>
              ))}
              {gastos.length === 0 && <p className="text-xs text-text-tertiary text-center py-4">Sin gastos registrados</p>}
            </div>
            <div className="border-t pt-2 flex justify-between text-sm font-semibold">
              <span className="text-gray-700">Total gastos</span>
              <span className="text-red-500">{formatCurrency(resumen.total_gastos_caja)}</span>
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="space-y-3">
          {[
            { icon: '💵', label: 'Efectivo', val: resumen.total_efectivo },
            { icon: '📱', label: 'Yape + Plin', val: resumen.total_yape + resumen.total_plin },
            { icon: '💳', label: 'Tarjetas', val: resumen.total_tarjetas },
            { icon: '🏦', label: 'Transferencias', val: resumen.total_transferencias },
          ].map(c => (
            <div key={c.label} className="bg-bg-card rounded-xl border border-border-primary px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-text-secondary">{c.icon} {c.label}</span>
              <span className="text-sm font-bold text-text-primary">{formatCurrency(c.val)}</span>
            </div>
          ))}
          <div className="bg-bg-card rounded-xl border border-border-primary p-4 space-y-2">
            <div className="flex justify-between text-sm font-bold text-text-primary">
              <span>TOTAL TURNO</span>
              <span>{formatCurrency(resumen.total_general)}</span>
            </div>
            <hr className="border-border-primary" />
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Saldo inicial</span>
              <span>{formatCurrency(turno.saldo_inicial)}</span>
            </div>
            <div className="flex justify-between text-xs text-red-400">
              <span>Gastos caja</span>
              <span>- {formatCurrency(resumen.total_gastos_caja)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-700 font-medium">
              <span>Efectivo neto</span>
              <span>{formatCurrency(resumen.efectivo_neto)}</span>
            </div>
            <hr className="border-border-primary" />
            <div className="flex justify-between text-sm font-bold text-info">
              <span>SALDO FINAL CAJA</span>
              <span>{formatCurrency(resumen.saldo_final_proyectado)}</span>
            </div>
          </div>
          <div className="text-center text-xs text-text-secondary">
            Check-ins: {resumen.total_checkins} · Check-outs: {resumen.total_checkouts}
          </div>
        </div>
      </div>
    </div>
  )
}
