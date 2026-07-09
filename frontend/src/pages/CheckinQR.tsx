import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import api from '../api/client'
import { useSocket } from '../hooks/useSocket'

interface Reserva {
  id: string
  codigo: string
  huesped_nombre: string
  huesped_email?: string
  habitacion_numero: string
  fecha_entrada: string
  fecha_salida: string
  estado: string
  updated_at?: string
}

interface CheckinQRResponse {
  reserva_id: string
  huesped_nombre: string
  habitacion_numero: string
  wifi_password?: string
  mensaje_bienvenida?: string
  check_in_time: string
}

interface QRData {
  qr_base64: string
  url?: string
}

interface ReservaRaw {
  id: string
  codigo: string
  estado: string
  huesped_nombre?: string
  huesped_email?: string
  habitacion_numero?: string
  huesped?: { nombre: string; apellido: string; email?: string }
  habitacion?: { numero: string }
  fecha_entrada: string
  fecha_salida: string
  updated_at?: string
}

function normalizeReserva(r: ReservaRaw): Reserva {
  return {
    id:                r.id,
    codigo:            r.codigo,
    huesped_nombre:    r.huesped_nombre ?? (r.huesped ? `${r.huesped.nombre} ${r.huesped.apellido}`.trim() : 'Huésped'),
    huesped_email:     r.huesped_email ?? r.huesped?.email,
    habitacion_numero: r.habitacion_numero ?? r.habitacion?.numero ?? '',
    fecha_entrada:     r.fecha_entrada,
    fecha_salida:      r.fecha_salida,
    estado:            r.estado,
    updated_at:        r.updated_at,
  }
}

const today = format(new Date(), 'yyyy-MM-dd')

const getAvatarColor = (name: string) => {
  const colors = ['#3B82F6', '#EF4444', '#22C55E', '#EAB308', '#8B5CF6', '#EC4899', '#14B8A6']
  if (!name) return colors[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

const getInitials = (name: string) => {
  if (!name) return '?'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, background: getAvatarColor(name), fontSize: size * 0.33 }}
    >
      {getInitials(name)}
    </div>
  )
}

function QRModal({ reservaId, guestName, onClose }: {
  reservaId: string
  guestName: string
  onClose: () => void
}) {
  const [qrData, setQrData] = useState<QRData | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.get<QRData>(`/api/v1/reservas/${reservaId}/qr-checkin`)
      .then(r => setQrData(r.data))
      .catch(() => {})
  }, [reservaId])

  const handleCopy = async () => {
    if (!qrData?.url) return
    try {
      await navigator.clipboard.writeText(qrData.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* silent */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-bg-card rounded-2xl shadow-2xl p-6 w-80 text-center">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">QR Check-in</h2>
        <p className="font-bold text-text-primary mb-4">{guestName}</p>

        {qrData ? (
          <>
            <img
              src={`data:image/png;base64,${qrData.qr_base64}`}
              alt="QR check-in"
              className="w-48 h-48 mx-auto rounded-xl border border-border-primary mb-4"
            />
            {qrData.url && (
              <p className="text-xs text-text-tertiary break-all mb-3 select-all">{qrData.url}</p>
            )}
            {qrData.url && (
              <button
                onClick={() => void handleCopy()}
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-bg-secondary mb-2"
              >
                {copied ? '✓ Copiado' : 'Copiar enlace'}
              </button>
            )}
          </>
        ) : (
          <div className="w-48 h-48 mx-auto flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <button onClick={onClose} className="w-full px-4 py-2 text-sm bg-bg-tertiary rounded-lg text-gray-700 hover:bg-gray-200">
          Cerrar
        </button>
      </div>
    </div>
  )
}

function CheckinSuccessCard({ result, onReset }: { result: CheckinQRResponse; onReset: () => void }) {
  return (
    <div className="mt-4 border-2 border-green-400 rounded-xl p-6 text-center bg-success-bg">
      <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4 shadow-lg"
        style={{ animation: 'bounceIn 0.5s ease' }}>
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-success mb-1">¡Check-in completado!</h3>
      <p className="text-2xl font-bold text-text-primary mb-0.5">{result.huesped_nombre}</p>
      <p className="text-text-secondary mb-4">Habitación <strong>{result.habitacion_numero}</strong></p>

      <div className="bg-bg-card rounded-xl p-4 mb-4 text-left space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Hora de check-in</span>
          <span className="font-semibold">{format(new Date(result.check_in_time), 'HH:mm dd/MM/yyyy')}</span>
        </div>
        {result.wifi_password && (
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">WiFi password</span>
            <span className="font-mono font-semibold text-info">{result.wifi_password}</span>
          </div>
        )}
      </div>

      {result.mensaje_bienvenida && (
        <div className="bg-info-bg rounded-xl p-3 mb-4 text-sm text-info text-left">
          {result.mensaje_bienvenida}
        </div>
      )}

      <button
        onClick={onReset}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
      >
        Nuevo check-in
      </button>
    </div>
  )
}

export default function CheckinQR() {
  const socketRef = useSocket('recepcion')
  const [qrToken, setQrToken] = useState('')
  const [validating, setValidating] = useState(false)
  const [checkinResult, setCheckinResult] = useState<CheckinQRResponse | null>(null)
  const [qrError, setQrError] = useState<{ msg: string; type: 'error' | 'warning' } | null>(null)
  const [hasCamera, setHasCamera] = useState(false)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [qrModal, setQrModal] = useState<{ reservaId: string; guestName: string } | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [showCompleted, setShowCompleted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const { data: confirmadas, isLoading } = useQuery<Reserva[]>({
    queryKey: ['checkins-confirmadas'],
    queryFn: () => api.get<{ data: ReservaRaw[] } | ReservaRaw[]>(`/api/v1/reservas?estado=CONFIRMADA&fecha_entrada=${today}`)
      .then(r => (Array.isArray(r.data) ? r.data : (r.data.data ?? [])).map(normalizeReserva)),
    refetchInterval: 20000,
  })

  const { data: realizadas } = useQuery<Reserva[]>({
    queryKey: ['checkins-realizados'],
    queryFn: () => api.get<{ data: ReservaRaw[] } | ReservaRaw[]>(`/api/v1/reservas?estado=CHECKIN_REALIZADO&fecha_entrada=${today}`)
      .then(r => (Array.isArray(r.data) ? r.data : (r.data.data ?? [])).map(normalizeReserva)),
    refetchInterval: 20000,
  })

  useEffect(() => {
    const confirmadasList: Reserva[] = Array.isArray(confirmadas) ? confirmadas : []
    const realizadasList: Reserva[] = Array.isArray(realizadas) ? realizadas : []
    setReservas([...confirmadasList, ...realizadasList])
  }, [confirmadas, realizadas])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return
    socket.on('reserva:estado_cambio', (data: { id: string; estado: string }) => {
      setReservas(prev => prev.map(r => r.id === data.id ? { ...r, estado: data.estado } : r))
      if (data.estado === 'CHECKIN_REALIZADO') {
        setCompletedIds(prev => new Set([...prev, data.id]))
      }
    })
    return () => { socket.off('reserva:estado_cambio') }
  }, [socketRef])

  useEffect(() => {
    if (!videoRef.current) return
    let stream: MediaStream | null = null
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          setHasCamera(true)
        }
      })
      .catch(() => setHasCamera(false))
    return () => { stream?.getTracks().forEach(t => t.stop()) }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handleValidateQR = async () => {
    if (!qrToken.trim()) return
    setValidating(true)
    setQrError(null)
    setCheckinResult(null)
    try {
      const { data } = await api.post<CheckinQRResponse>('/api/v1/checkin/qr', { token: qrToken.trim() })
      setCheckinResult(data)
      setQrToken('')
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } }).response?.status
      if (status === 409) {
        setQrError({ msg: 'Check-in ya realizado', type: 'warning' })
      } else {
        setQrError({ msg: 'QR inválido o expirado', type: 'error' })
      }
    } finally { setValidating(false) }
  }

  const handleCheckin = async (reservaId: string) => {
    try {
      await api.patch(`/api/v1/reservas/${reservaId}/estado`, { estado: 'CHECKIN_REALIZADO' })
      setReservas(prev => prev.map(r => r.id === reservaId ? { ...r, estado: 'CHECKIN_REALIZADO' } : r))
      setCompletedIds(prev => new Set([...prev, reservaId]))
    } catch { setToast('Error al realizar check-in') }
  }

  const pendientes = (reservas ?? []).filter(r => r.estado === 'CONFIRMADA')
  const completados = (reservas ?? []).filter(r => r.estado === 'CHECKIN_REALIZADO')

  if (isLoading) return (
    <div className="flex items-center justify-center h-full min-h-screen bg-slate-900">
      <p className="text-white text-lg">Cargando check-ins...</p>
    </div>
  )

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-gray-900 text-white rounded-xl shadow-xl text-sm font-medium">{toast}</div>
      )}
      {qrModal && (
        <QRModal
          reservaId={qrModal.reservaId}
          guestName={qrModal.guestName}
          onClose={() => setQrModal(null)}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Check-in Digital QR</h1>
        <p className="text-text-secondary text-sm mt-0.5">Escanea o busca la reserva</p>
      </div>

      <div className="flex gap-6">
        {/* LEFT COLUMN */}
        <div className="w-1/2">
          <div className="bg-bg-card rounded-2xl border border-border-primary shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-lg">📷</span>
              <h2 className="text-sm font-semibold text-text-primary">Escanear QR</h2>
            </div>

            {/* QR box */}
            <div className="border-2 border-dashed border-gray-300 rounded-2xl overflow-hidden mb-5"
              style={{ width: 300, height: 300, margin: '0 auto' }}>
              {hasCamera ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
                  <video ref={videoRef} className="hidden" />
                  <svg className="w-20 h-20 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 4H7a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V5a1 1 0 00-1-1zM17 4h-2a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1V5a1 1 0 00-1-1zM12 17H7a1 1 0 00-1 1v1a1 1 0 001 1h5a1 1 0 001-1v-1a1 1 0 00-1-1zM4 17v-2a1 1 0 011-1h2a1 1 0 011 1v2M17 14h-2a1 1 0 00-1 1v4a1 1 0 001 1h2a1 1 0 001-1v-4a1 1 0 00-1-1z" />
                  </svg>
                  <p className="text-sm font-medium text-text-secondary">Cámara no disponible en escritorio</p>
                  <p className="text-xs text-text-tertiary mt-1">Usa el buscador manual o pide al huésped el código</p>
                </div>
              )}
            </div>

            {/* Manual input */}
            <div className="space-y-3">
              <input
                type="text"
                value={qrToken}
                onChange={e => setQrToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void handleValidateQR()}
                placeholder="Pega el token QR aquí..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                onClick={() => void handleValidateQR()}
                disabled={!qrToken.trim() || validating}
                className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {validating ? 'Validando...' : 'Validar QR'}
              </button>
            </div>

            {qrError && (
              <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium ${
                qrError.type === 'error'
                  ? 'bg-danger-bg border border-danger text-danger'
                  : 'bg-warning-bg border border-warning text-warning'
              }`}>
                {qrError.msg}
              </div>
            )}

            {checkinResult && (
              <CheckinSuccessCard
                result={checkinResult}
                onReset={() => { setCheckinResult(null); setQrToken('') }}
              />
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="w-1/2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Llegadas de hoy</h2>
            <span className="bg-info-bg text-info text-xs font-bold px-2 py-0.5 rounded-full">
              {reservas.length}
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-info-bg border border-info rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-info">{pendientes.length}</p>
              <p className="text-xs text-blue-600 font-medium">Pendientes</p>
            </div>
            <div className="bg-success-bg border border-success rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-success">{completados.length}</p>
              <p className="text-xs text-success font-medium">Completados</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-700">{reservas.length}</p>
              <p className="text-xs text-orange-600 font-medium">Total esperado</p>
            </div>
          </div>

          {/* Reservations list */}
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 600 }}>
            {/* Pendientes section */}
            {pendientes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                  Pendientes ({pendientes.length})
                </p>
                {pendientes.map(r => (
                  <div
                    key={r.id}
                    className={`bg-bg-card border border-border-primary rounded-xl p-3 mb-2 shadow-sm transition-all ${completedIds.has(r.id) ? 'border-l-4 border-l-green-500' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={r.huesped_nombre} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{r.huesped_nombre}</p>
                        {r.huesped_email && (
                          <p className="text-xs text-text-tertiary truncate">{r.huesped_email}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs bg-bg-tertiary text-text-secondary px-1.5 py-0.5 rounded">
                          HAB-{r.habitacion_numero}
                        </span>
                        <span className="text-xs text-text-tertiary">
                          {format(parseISO(r.fecha_entrada), 'HH:mm dd/MM')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-info-bg text-info">
                        Pendiente
                      </span>
                      <div className="flex-1" />
                      <button
                        onClick={() => setQrModal({ reservaId: r.id, guestName: r.huesped_nombre })}
                        className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-text-secondary hover:bg-bg-secondary"
                        title="Ver QR"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 4H7a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V5a1 1 0 00-1-1z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => void handleCheckin(r.id)}
                        className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
                      >
                        Check-in
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completados section */}
            {completados.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCompleted(v => !v)}
                  className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 hover:text-gray-700"
                >
                  <span>{showCompleted ? '▼' : '▶'}</span>
                  Completados ({completados.length})
                </button>
                {showCompleted && completados.map(r => (
                  <div key={r.id} className="bg-bg-card border border-l-4 border-l-green-500 border-border-primary rounded-xl p-3 mb-2 shadow-sm opacity-75">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.huesped_nombre} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700 truncate">{r.huesped_nombre}</p>
                        <p className="text-xs text-text-tertiary">HAB-{r.habitacion_numero}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success-bg text-success">
                        Completado ✓
                      </span>
                    </div>
                    {r.updated_at && (
                      <p className="text-xs text-text-tertiary mt-1 ml-12">
                        Check-in: {format(new Date(r.updated_at), 'HH:mm')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {reservas.length === 0 && (
              <div className="text-center py-12 text-text-tertiary">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-sm">Sin llegadas para hoy</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
