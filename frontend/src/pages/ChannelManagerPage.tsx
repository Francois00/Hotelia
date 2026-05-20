import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import api from '../api/client'
import ModalConfigCanal from '../components/ModalConfigCanal'

interface SyncLogEntry {
  id: string
  canal: string
  evento: string
  exito: boolean
  reserva_id?: string
  error_msg?: string
  created_at: string
}

interface SyncLogResp {
  data: SyncLogEntry[]
  total: number
}

type CanalNombre = 'booking' | 'expedia' | 'whatsapp' | 'web'

interface CanalInfo {
  id: CanalNombre
  nombre: string
  icono: string
  descripcion: string
}

const CANALES: CanalInfo[] = [
  { id: 'booking',   nombre: 'Booking.com',        icono: '🏨', descripcion: 'OTA principal' },
  { id: 'expedia',   nombre: 'Expedia',             icono: '✈️', descripcion: 'OTA secundaria' },
  { id: 'whatsapp',  nombre: 'WhatsApp Business',   icono: '💬', descripcion: 'Canal directo' },
  { id: 'web',       nombre: 'Web propia',          icono: '🌐', descripcion: 'Motor de reservas' },
]

function getEstado(canal: CanalNombre, logs: SyncLogEntry[]) {
  const propios = logs.filter(l => l.canal === canal)
  if (propios.length === 0) return { dot: '⚪', label: 'NO CONFIGURADO', cls: 'bg-gray-100 text-gray-500' }
  const errores = propios.slice(0, 3).filter(l => !l.exito).length
  if (errores >= 3) return { dot: '🔴', label: 'ERROR', cls: 'bg-red-100 text-red-700' }
  const diffMs = Date.now() - new Date(propios[0].created_at).getTime()
  if (diffMs > 3_600_000) return { dot: '🟠', label: 'ADVERTENCIA', cls: 'bg-orange-100 text-orange-700' }
  return { dot: '🟢', label: 'CONECTADO', cls: 'bg-green-100 text-green-700' }
}

export default function ChannelManagerPage() {
  const [configCanal, setConfigCanal] = useState<CanalNombre | null>(null)
  const [syncingCanal, setSyncingCanal] = useState<CanalNombre | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const { data: logResp, isLoading: logLoading, refetch } = useQuery<SyncLogResp>({
    queryKey: ['sync-log'],
    queryFn: () => api.get<SyncLogResp>('/api/v1/canales/sync-log?limit=50').then(r => r.data),
    retry: false,
    staleTime: 30_000,
  })

  const syncLog = logResp?.data ?? []

  const showBanner = (msg: string) => {
    setBanner(msg)
    setTimeout(() => setBanner(null), 4000)
  }

  const handleSync = async (canal: CanalNombre) => {
    setSyncingCanal(canal)
    try {
      await api.post(`/api/v1/canales/sync/${canal}`)
      showBanner(`Sincronización de ${canal} iniciada`)
      void refetch()
    } catch {
      showBanner(`Sync de ${canal}: endpoint no disponible aún — configura las credenciales primero`)
    } finally {
      setSyncingCanal(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Channel Manager</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gestión de canales de distribución OTA</p>
      </div>

      {banner && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          {banner}
        </div>
      )}

      {/* ── Sección A — Estado de canales ────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Estado de canales</h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {CANALES.map(canal => {
            const estado   = getEstado(canal.id, syncLog)
            const ultimoLog = syncLog.find(l => l.canal === canal.id)
            const syncing  = syncingCanal === canal.id
            return (
              <div key={canal.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-2xl shrink-0">{canal.icono}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{canal.nombre}</p>
                    <p className="text-xs text-gray-400">{canal.descripcion}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${estado.cls}`}>
                  {estado.dot} {estado.label}
                </span>
                <p className="text-xs text-gray-400">
                  {ultimoLog
                    ? `Última sync: ${format(parseISO(ultimoLog.created_at), 'dd/MM/yy HH:mm')}`
                    : 'Sin sincronizaciones registradas'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfigCanal(canal.id)}
                    className="flex-1 text-xs px-2 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Configurar
                  </button>
                  {canal.id !== 'web' && (
                    <button
                      onClick={() => void handleSync(canal.id)}
                      disabled={syncing}
                      className="flex-1 text-xs px-2 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                    >
                      {syncing && (
                        <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      )}
                      Sync
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Sección B — Calendario de disponibilidad ──────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Calendario de disponibilidad por canal</h2>
        <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
          <span className="text-5xl">📅</span>
          <div>
            <p className="text-gray-700 font-semibold">Integración con OTAs pendiente de configuración</p>
            <p className="text-sm text-gray-400 mt-1 max-w-sm">
              Configura las credenciales de Booking.com y Expedia para sincronizar y visualizar la disponibilidad por canal.
            </p>
          </div>
          <button
            onClick={() => setConfigCanal('booking')}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Configurar canales
          </button>
        </div>
      </section>

      {/* ── Sección C — Acciones rápidas + Log ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Acciones rápidas */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Acciones rápidas</h2>
          <div className="space-y-2">
            <ActionBtn
              icon="🟢"
              title="Abrir habitaciones en OTAs"
              desc="Habilitar disponibilidad en canales externos"
              onClick={() => showBanner('Acción de apertura: configura primero las credenciales OTA')}
            />
            <ActionBtn
              icon="🔴"
              title="Cerrar habitaciones en OTAs"
              desc="Bloquear disponibilidad en canales externos"
              onClick={() => showBanner('Acción de cierre: configura primero las credenciales OTA')}
            />
          </div>
        </div>

        {/* Log de sincronización */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Log de sincronización</h2>
          </div>
          {logLoading ? (
            <div className="flex items-center justify-center py-10">
              <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : syncLog.length === 0 ? (
            <p className="px-5 py-8 text-center text-gray-400 text-sm">
              No hay sincronizaciones registradas
            </p>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['Fecha', 'Canal', 'Evento', 'Estado'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {syncLog.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {format(parseISO(entry.created_at), 'dd/MM/yy HH:mm')}
                      </td>
                      <td className="px-3 py-2 text-xs font-medium text-gray-700 capitalize">
                        {entry.canal}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{entry.evento}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.exito ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {entry.exito ? '✅ OK' : '❌ Error'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {configCanal && (
        <ModalConfigCanal
          canal={configCanal}
          onClose={() => setConfigCanal(null)}
          onSuccess={() => { setConfigCanal(null); void refetch() }}
        />
      )}
    </div>
  )
}

function ActionBtn({ icon, title, desc, onClick }: {
  icon: string; title: string; desc: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
    >
      <span className="text-xl shrink-0">{icon}</span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
    </button>
  )
}
