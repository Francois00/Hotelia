import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

interface Props {
  onClose: () => void
  onOpened: () => void
}

export default function AbrirTurnoModal({ onClose, onOpened }: Props) {
  const navigate = useNavigate()
  const hora = new Date().getHours()
  const [tipo, setTipo] = useState<'DIA' | 'NOCHE'>(hora >= 6 && hora < 18 ? 'DIA' : 'NOCHE')
  const [saldo, setSaldo] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAbrir = async () => {
    setError('')
    const s = parseFloat(saldo)
    if (isNaN(s) || s < 0) return setError('Ingresa un saldo válido (≥ 0)')
    setSaving(true)
    try {
      await api.post('/api/v1/turnos/abrir', { tipo, saldo_inicial: s })
      onOpened()
      navigate('/turno')
    } catch (e: unknown) {
      const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'TURNO_YA_ABIERTO')
        setError('Ya hay un turno abierto. Ciérralo primero.')
      else
        setError('Error al abrir el turno')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <h2 className="text-lg font-semibold text-text-primary text-center">Abrir nuevo turno</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de turno</label>
          <div className="space-y-2">
            {[
              { value: 'DIA', label: 'DÍA', sub: '06:00 – 18:00' },
              { value: 'NOCHE', label: 'NOCHE', sub: '18:00 – 06:00' },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer p-3 border rounded-xl hover:bg-bg-secondary transition-colors">
                <input type="radio" name="tipo" value={opt.value} checked={tipo === opt.value}
                  onChange={() => setTipo(opt.value as 'DIA' | 'NOCHE')} className="accent-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">{opt.label}</p>
                  <p className="text-xs text-text-tertiary">{opt.sub}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Saldo inicial en caja</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">S/</span>
            <input type="number" step="0.01" min={0} value={saldo}
              onChange={e => setSaldo(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <p className="text-xs text-text-tertiary mt-1">💡 Cuenta el efectivo físico que hay en caja ahora</p>
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-bg-secondary">
            Cancelar
          </button>
          <button onClick={handleAbrir} disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Abriendo...' : 'Abrir turno'}
          </button>
        </div>
      </div>
    </div>
  )
}
