import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

interface Resumen {
  total_checkins: number; total_checkouts: number
  total_efectivo: number; total_yape: number; total_plin: number
  total_tarjetas: number; total_transferencias: number
  total_general: number; total_gastos_caja: number
  efectivo_neto: number; saldo_final_proyectado: number
}

interface Props {
  turnoId: string
  turnoTipo: string
  resumen: Resumen
  onClose: () => void
  onCerrado: () => void
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)

export default function CerrarTurnoModal({ turnoId, turnoTipo, resumen, onClose, onCerrado }: Props) {
  const navigate = useNavigate()
  const [paso, setPaso] = useState<1 | 2>(1)
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [closedData, setClosedData] = useState<{ hora_cierre: string } | null>(null)

  const handleCerrar = async () => {
    setError('')
    if (!pin) return setError('Ingresa tu contraseña')
    setSaving(true)
    try {
      const r = await api.post<{ turno_id: string; hora_cierre: string }>(
        `/api/v1/turnos/${turnoId}/cerrar`,
        { pin },
      )
      setClosedData(r.data)
      onCerrado()
      setPaso(2)
    } catch (e: unknown) {
      const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'PIN_INVALIDO') setError('Contraseña incorrecta. Inténtalo de nuevo.')
      else setError('Error al cerrar el turno')
    } finally { setSaving(false) }
  }

  const downloadPdf = async () => {
    try {
      const response = await api.get(`/api/v1/turnos/${turnoId}/reporte/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-turno-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { /* silencioso */ }
  }

  if (paso === 2 && closedData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-3xl">✅</div>
          <h2 className="text-xl font-bold text-gray-900">Turno cerrado correctamente</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p><b>Hora de cierre:</b> {new Date(closedData.hora_cierre).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
            <p><b>Total del turno:</b> {formatCurrency(resumen.total_general)}</p>
          </div>
          <div className="space-y-2">
            <button onClick={() => void downloadPdf()} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              📄 Descargar PDF
            </button>
            <button
              onClick={() => { onClose(); navigate('/dashboard') }}
              className="w-full text-sm text-blue-600 hover:underline"
            >
              Ir al Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900 text-center">Cerrar turno {turnoTipo}</h2>

        <div className="border border-gray-200 rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">Resumen del turno</h3>
          {[
            { label: 'Check-ins realizados', val: resumen.total_checkins },
            { label: 'Check-outs realizados', val: resumen.total_checkouts },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-sm">
              <span className="text-gray-600">{r.label}</span>
              <span className="font-medium">{r.val}</span>
            </div>
          ))}
          <hr className="border-gray-100" />
          {[
            { label: 'Total efectivo', val: resumen.total_efectivo },
            { label: 'Total Yape/Plin', val: resumen.total_yape + resumen.total_plin },
            { label: 'Total tarjetas', val: resumen.total_tarjetas },
            { label: 'Gastos de caja', val: -resumen.total_gastos_caja, neg: true },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-sm">
              <span className="text-gray-600">{r.label}</span>
              <span className={`font-medium ${r.neg ? 'text-red-500' : ''}`}>
                {r.neg ? '- ' : ''}{formatCurrency(Math.abs(r.val))}
              </span>
            </div>
          ))}
          <hr className="border-gray-200" />
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL TURNO</span>
            <span>{formatCurrency(resumen.total_general)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-blue-700">
            <span>SALDO FINAL CAJA</span>
            <span>{formatCurrency(resumen.saldo_final_proyectado)}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirma tu contraseña para firmar</label>
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void handleCerrar()}
            placeholder="La misma con la que iniciaste sesión"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={() => void handleCerrar()} disabled={saving}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {saving ? 'Cerrando...' : 'Cerrar y firmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
