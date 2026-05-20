import { useState } from 'react'
import { format, parseISO } from 'date-fns'

interface Evento {
  key: string
  label: string
  defaultOn: boolean
}

const EVENTOS: Evento[] = [
  { key: 'checkin',       label: 'Nuevo check-in',          defaultOn: true  },
  { key: 'checkout',      label: 'Checkout',                defaultOn: true  },
  { key: 'mantenimiento', label: 'Alerta de mantenimiento', defaultOn: true  },
  { key: 'cierre_turno',  label: 'Cierre de turno',         defaultOn: true  },
  { key: 'stock_bajo',    label: 'Stock bajo en almacén',   defaultOn: true  },
  { key: 'gasto_caja',    label: 'Gasto de caja',           defaultOn: false },
]

interface LogEntry {
  id: string
  fecha: string
  evento: string
  destinatario: string
  estado: 'ENVIADO' | 'PENDIENTE' | 'FALLIDO'
}

const MOCK_LOG: LogEntry[] = []

export default function NotificacionesPage() {
  const [groupId, setGroupId] = useState(() => localStorage.getItem('wpp_group_id') ?? '')
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('wpp_toggles')
      if (saved) return JSON.parse(saved) as Record<string, boolean>
    } catch { /* ignore */ }
    return Object.fromEntries(EVENTOS.map(e => [e.key, e.defaultOn]))
  })
  const [saving, setSaving]     = useState(false)
  const [testing, setTesting]   = useState(false)
  const [banner, setBanner]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [log] = useState<LogEntry[]>(MOCK_LOG)

  const showBanner = (msg: string, ok = true) => {
    setBanner({ msg, ok })
    setTimeout(() => setBanner(null), 4000)
  }

  const toggle = (key: string) =>
    setToggles(prev => ({ ...prev, [key]: !prev[key] }))

  const handleGuardar = async () => {
    setSaving(true)
    try {
      localStorage.setItem('wpp_group_id', groupId)
      localStorage.setItem('wpp_toggles', JSON.stringify(toggles))
      showBanner('Configuración guardada correctamente')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!groupId.trim()) {
      showBanner('Ingresa el Group ID antes de enviar un mensaje de prueba', false)
      return
    }
    setTesting(true)
    try {
      // El endpoint de grupo aún no está implementado; mostramos aviso
      showBanner(
        'Mensaje de prueba: endpoint de grupo WhatsApp pendiente de implementación en backend',
        false,
      )
    } finally {
      setTesting(false)
    }
  }

  const estadoBadge = (estado: LogEntry['estado']) => {
    if (estado === 'ENVIADO')  return 'bg-green-100 text-green-700'
    if (estado === 'PENDIENTE') return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  const estadoIcon = (estado: LogEntry['estado']) =>
    ({ ENVIADO: '✅', PENDIENTE: '⏳', FALLIDO: '❌' })[estado]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notificaciones WhatsApp</h1>
        <p className="text-gray-500 text-sm mt-0.5">Envío automático de eventos al grupo interno del hotel</p>
      </div>

      {banner && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${
          banner.ok
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {banner.msg}
        </div>
      )}

      {/* ── Sección A — Configuración del grupo ───────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-900">Configuración del grupo</h2>

        {/* Group ID */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Group ID de WhatsApp
          </label>
          <input
            type="text"
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            placeholder="120363XXXXXXXXX@g.us"
            className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Encuentra el ID en Meta Business Manager → WhatsApp → Grupos
          </p>
        </div>

        {/* Toggles */}
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-3">Eventos que notificar</p>
          <div className="grid grid-cols-2 gap-3">
            {EVENTOS.map(evento => (
              <label
                key={evento.key}
                className="flex items-center gap-3 px-3 py-2.5 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div
                  onClick={() => toggle(evento.key)}
                  className={`w-10 h-5 rounded-full relative transition-colors shrink-0 cursor-pointer ${
                    toggles[evento.key] ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    toggles[evento.key] ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </div>
                <span className="text-sm text-gray-700">{evento.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => void handleTest()}
            disabled={testing}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            {testing && (
              <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
            )}
            💬 Enviar mensaje de prueba
          </button>
          <button
            onClick={() => void handleGuardar()}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            )}
            Guardar configuración
          </button>
        </div>
      </div>

      {/* ── Sección B — Log de notificaciones ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Log de notificaciones</h2>
        </div>
        {log.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400 text-sm">
            <p className="text-3xl mb-3">📭</p>
            Los mensajes enviados aparecerán aquí
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Fecha/hora', 'Evento', 'Destinatario', 'Estado', 'Acción'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {log.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {format(parseISO(entry.fecha), 'dd/MM/yy HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{entry.evento}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">{entry.destinatario}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge(entry.estado)}`}>
                        {estadoIcon(entry.estado)} {entry.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.estado === 'FALLIDO' && (
                        <button className="text-xs text-blue-600 hover:underline">Reenviar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
