import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

interface Comprobante {
  tipo: string
  serie: string
  correlativo: string
  pdf_url?: string | null
}

interface Props {
  reservaId: string
  habitacionNumero: string
  huespedNombre: string
  noches: number
  total: number
  tipoComprobante: string
  comprobante?: Comprobante | null
}

export default function ModalCheckoutExitoso({
  reservaId, habitacionNumero, huespedNombre, noches, total, tipoComprobante, comprobante,
}: Props) {
  const navigate = useNavigate()

  const handlePrint = () => {
    if (comprobante?.pdf_url) {
      window.open(comprobante.pdf_url)
      return
    }
    api.get(`/api/v1/comprobantes/reserva/${reservaId}`, { responseType: 'blob' })
      .then(r => {
        const url = URL.createObjectURL(r.data as Blob)
        window.open(url)
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      })
      .catch(() => {})
  }

  const comprobanteLabel = comprobante
    ? `${tipoComprobante === 'BOLETA' ? 'Boleta' : 'Factura'} ${comprobante.serie}-${comprobante.correlativo}`
    : tipoComprobante === 'BOLETA' ? 'Boleta de venta' : 'Factura electrónica'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center space-y-5">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900">Checkout completado</h2>
          <p className="text-sm text-gray-500 mt-1">La habitación quedó en estado limpieza</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5 text-left">
          <div className="flex justify-between">
            <span className="text-gray-500">Habitación</span>
            <span className="font-medium text-gray-900">Hab. {habitacionNumero}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Huésped</span>
            <span className="font-medium text-gray-900 truncate max-w-40">{huespedNombre}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Estadía</span>
            <span className="font-medium text-gray-900">{noches} {noches === 1 ? 'noche' : 'noches'}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
            <span className="text-gray-500">Total cobrado</span>
            <span className="font-bold text-gray-900">
              {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(total)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Comprobante</span>
            <span className="font-medium text-gray-900 text-right max-w-40">{comprobanteLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-base">🧹</span>
            <span className="text-gray-500 text-xs">Habitación en cola de limpieza</span>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={handlePrint}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <span>🖨️</span>
            Imprimir comprobante
          </button>
          <button
            onClick={() => navigate('/reservas?estado=CHECKIN_REALIZADO')}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium"
          >
            + Nuevo checkout
          </button>
          <button
            onClick={() => navigate('/reservas')}
            className="w-full text-sm text-gray-400 hover:text-gray-600 hover:underline py-1"
          >
            Ver todas las reservas
          </button>
        </div>
      </div>
    </div>
  )
}
