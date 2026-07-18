import { useEffect, useState } from 'react'
import api from '../api/client'

interface HabitacionOpcion {
  id: string
  numero: string
  tipo: string
}

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function ModalConectarIcal({ onClose, onSuccess }: Props) {
  const [habitaciones, setHabitaciones] = useState<HabitacionOpcion[]>([])
  const [habitacionId, setHabitacionId] = useState('')
  const [canal, setCanal] = useState<'BOOKING_COM' | 'EXPEDIA'>('BOOKING_COM')
  const [urlExterna, setUrlExterna] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get('/api/v1/habitaciones?limit=100')
      .then(r => {
        const data = r.data?.data ?? r.data ?? []
        setHabitaciones(data)
        if (data[0]) setHabitacionId(data[0].id)
      })
      .catch(() => setHabitaciones([]))
  }, [])

  const guardar = async () => {
    if (!habitacionId) return
    setSaving(true)
    setError(null)
    try {
      await api.post('/api/v1/channel-manager/ical', {
        habitacion_id: habitacionId,
        canal,
        ical_url_externa: urlExterna || undefined,
      })
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'No se pudo crear la conexión'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-5 border-b border-border-primary flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Conectar habitación vía iCal</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary text-2xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Habitación</label>
            <select
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={habitacionId}
              onChange={e => setHabitacionId(e.target.value)}
            >
              {habitaciones.map(h => (
                <option key={h.id} value={h.id}>Hab. {h.numero} — {h.tipo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Canal</label>
            <select
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={canal}
              onChange={e => setCanal(e.target.value as 'BOOKING_COM' | 'EXPEDIA')}
            >
              <option value="BOOKING_COM">Booking.com</option>
              <option value="EXPEDIA">Expedia</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              URL de {canal === 'BOOKING_COM' ? 'Booking.com' : 'Expedia'} a importar (opcional por ahora)
            </label>
            <input
              type="text"
              value={urlExterna}
              onChange={e => setUrlExterna(e.target.value)}
              placeholder="https://admin.booking.com/hotel/hoteladmin/ical/..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <div className="text-sm text-danger">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t border-border-primary flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-bg-secondary">
            Cancelar
          </button>
          <button
            onClick={() => void guardar()}
            disabled={saving || !habitacionId}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Conectar'}
          </button>
        </div>
      </div>
    </div>
  )
}
