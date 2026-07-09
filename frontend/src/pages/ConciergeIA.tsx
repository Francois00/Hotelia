import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import api from '../api/client'
import ia from '../api/ia'
import { useSocket } from '../hooks/useSocket'

interface Conversacion {
  id: string
  huesped_id: string
  huesped_nombre: string
  habitacion_id?: string
  habitacion_numero: string
  reserva_id: string
  reserva_codigo?: string
  fecha_entrada?: string
  fecha_salida?: string
  ultimo_mensaje: string
  escalado: boolean
  escalado_motivo?: string
  updated_at: string
  huesped?: {
    segmento_crm?: string
    idioma_preferido?: string
    preferencias?: Record<string, string>
  }
}

interface Mensaje {
  id: string
  tipo: string
  contenido: string
  escalado: boolean
  escalado_motivo?: string
  created_at: string
}

interface Alerta {
  id: string
  tipo: string
  descripcion?: string
  mensaje?: string
  nivel?: string
}

interface EnviarResponse {
  respuesta: string
  mensaje_id: string
}

const getAvatarColor = (name: string) => {
  const colors = ['#3B82F6', '#EF4444', '#22C55E', '#EAB308', '#8B5CF6', '#EC4899', '#14B8A6']
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

const getInitials = (name: string) => {
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

const formatRelative = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return format(new Date(dateStr), 'dd/MM')
}

export default function ConciergeIA() {
  const navigate = useNavigate()
  const socketRef = useSocket('recepcion')
  const [filter, setFilter] = useState<'todos' | 'escalados'>('todos')
  const [conversations, setConversations] = useState<Conversacion[]>([])
  const [selected, setSelected] = useState<Conversacion | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [tomaControl, setTomaControl] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState<Set<string>>(new Set())
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: escaladosData } = useQuery<Conversacion[]>({
    queryKey: ['concierge-escalados'],
    queryFn: () => ia.get<{ escalados?: Conversacion[] }>('/ia/v1/concierge/escalados')
      .then(r => Array.isArray(r.data) ? r.data : (r.data.escalados ?? [])),
    retry: false,
    refetchInterval: 15000,
  })

  useEffect(() => {
    if (escaladosData) setConversations(escaladosData)
  }, [escaladosData])

  useEffect(() => {
    if (!selected) return
    ia.get<{ mensajes?: Mensaje[] }>(`/ia/v1/concierge/historial/${selected.huesped_id}`)
      .then(r => setMensajes(Array.isArray(r.data) ? r.data : (r.data.mensajes ?? []))).catch(() => {})
    setTomaControl(false)
    setUnread(prev => { const next = new Set(prev); next.delete(selected.id); return next })
  }, [selected])

  useEffect(() => {
    if (selected?.habitacion_id) {
      api.get<Alerta[]>(`/api/v1/habitaciones/${selected.habitacion_id}/alertas`)
        .then(r => setAlertas(r.data)).catch(() => {})
    } else {
      setAlertas([])
    }
  }, [selected?.habitacion_id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return
    socket.on('concierge:mensaje_nuevo', (data: Conversacion) => {
      setConversations(prev => {
        const exists = prev.find(c => c.id === data.id)
        if (exists) return prev.map(c => c.id === data.id ? { ...data } : c)
        return [data, ...prev]
      })
      if (!selected || selected.id !== data.id) {
        setUnread(prev => new Set([...prev, data.id]))
      }
    })
    return () => { socket.off('concierge:mensaje_nuevo') }
  }, [socketRef, selected])

  const filtered = filter === 'escalados'
    ? conversations.filter(c => c.escalado)
    : conversations

  const escaladosCount = conversations.filter(c => c.escalado).length

  const handleSend = async () => {
    if (!message.trim() || !selected || sending) return
    const msgText = message.trim()
    setSending(true)
    setMessage('')
    try {
      const historial = mensajes.slice(-10)
      const { data } = await ia.post<EnviarResponse>('/ia/v1/concierge/mensaje', {
        mensaje: msgText,
        huesped_id: selected.huesped_id,
        reserva_id: selected.reserva_id,
        historial,
      })
      const now = new Date().toISOString()
      setMensajes(prev => [
        ...prev,
        { id: `local-${Date.now()}`, tipo: 'recepcion', contenido: msgText, escalado: false, created_at: now },
        { id: data.mensaje_id, tipo: 'aria', contenido: data.respuesta, escalado: false, created_at: now },
      ])
    } catch { /* silent */ } finally { setSending(false) }
  }

  return (
    <div className="flex h-full overflow-hidden bg-bg-card">
      {/* LEFT COLUMN */}
      <div className="w-72 border-r border-border-primary flex flex-col bg-bg-card shrink-0">
        <div className="px-4 py-4 border-b border-border-primary">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-text-primary">Concierge IA</h1>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="En vivo" />
          </div>
          <div className="flex gap-1 mt-3">
            <button
              onClick={() => setFilter('todos')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === 'todos' ? 'bg-info-bg text-info' : 'text-text-secondary hover:bg-bg-tertiary'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('escalados')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${filter === 'escalados' ? 'bg-danger-bg text-danger' : 'text-text-secondary hover:bg-bg-tertiary'}`}
            >
              Escalados
              {escaladosCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">{escaladosCount}</span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-text-tertiary text-sm">
              <p>Sin conversaciones</p>
            </div>
          )}
          {filtered.map(conv => (
            <button
              key={conv.id}
              type="button"
              onClick={() => setSelected(conv)}
              className={`w-full px-4 py-3 flex items-start gap-3 border-b border-border-primary text-left hover:bg-bg-secondary transition-colors ${selected?.id === conv.id ? 'bg-info-bg border-l-2 border-l-blue-500' : ''}`}
            >
              <div className="relative shrink-0">
                <Avatar name={conv.huesped_nombre} size={40} />
                {unread.has(conv.id) && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-primary truncate">{conv.huesped_nombre}</p>
                  <span className="text-xs text-text-tertiary shrink-0 ml-1">{formatRelative(conv.updated_at)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded">HAB-{conv.habitacion_numero}</span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5 truncate w-full">{conv.ultimo_mensaje}</p>
                {conv.escalado && (
                  <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-xs font-medium bg-danger-bg text-danger">
                    escalado
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CENTER COLUMN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary gap-3">
            <span className="text-5xl">💬</span>
            <p className="text-sm">Selecciona una conversación</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between bg-bg-card shrink-0">
              <div className="flex items-center gap-3">
                <Avatar name={selected.huesped_nombre} size={36} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">{selected.huesped_nombre}</p>
                    <span className="text-xs bg-bg-tertiary text-text-secondary px-1.5 py-0.5 rounded">HAB-{selected.habitacion_numero}</span>
                    {selected.huesped?.segmento_crm && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full text-white font-semibold"
                        style={{ background: '#F59E0B' }}>
                        {selected.huesped.segmento_crm}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary">
                    {selected.fecha_entrada && selected.fecha_salida
                      ? `${format(parseISO(selected.fecha_entrada), 'dd/MM')} → ${format(parseISO(selected.fecha_salida), 'dd/MM')}`
                      : selected.reserva_codigo ?? ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTomaControl(v => !v)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${tomaControl ? 'bg-blue-600 text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-gray-200'}`}
              >
                {tomaControl ? '⚡ Recepción activa' : '🤖 Aria responde'}
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-bg-secondary space-y-3">
              {mensajes.length === 0 && (
                <div className="text-center py-8 text-text-tertiary text-sm">Sin mensajes</div>
              )}
              {mensajes.map(msg => {
                const isHuesped = msg.tipo === 'huesped'
                const isAria = msg.tipo === 'aria'
                return (
                  <div key={msg.id} className={`flex gap-2 ${isHuesped ? 'justify-start' : 'justify-end'}`}>
                    {isHuesped && <Avatar name={selected.huesped_nombre} size={28} />}
                    <div className={`max-w-xs lg:max-w-sm ${isHuesped ? 'order-2' : ''}`}>
                      {msg.escalado && (
                        <div className="mb-1 px-3 py-1.5 bg-orange-100 border border-orange-200 rounded-lg text-xs text-orange-700 font-medium">
                          ⚠ Escalado a recepción{msg.escalado_motivo ? ` — ${msg.escalado_motivo}` : ''}
                        </div>
                      )}
                      <div className={`px-3 py-2 rounded-lg text-sm ${
                        isHuesped ? 'bg-bg-card border border-border-primary text-gray-800 rounded-tl-none shadow-sm'
                        : isAria ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-blue-800 text-white rounded-tr-none'
                      }`}>
                        {msg.contenido}
                      </div>
                      <div className={`flex items-center gap-1 mt-0.5 ${isHuesped ? 'justify-start' : 'justify-end'}`}>
                        {!isHuesped && <span className="text-xs text-text-tertiary">{isAria ? 'Aria' : 'Recepción'}</span>}
                        <span className="text-xs text-text-tertiary">{format(new Date(msg.created_at), 'HH:mm')}</span>
                      </div>
                    </div>
                    {!isHuesped && (
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {isAria ? 'A' : 'R'}
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border-primary bg-bg-card shrink-0">
              {!tomaControl ? (
                <div className="w-full px-4 py-3 rounded-xl bg-bg-tertiary text-text-tertiary text-sm">
                  🤖 Aria está respondiendo automáticamente
                </div>
              ) : (
                <div className="flex gap-2">
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSend()
                      }
                    }}
                    placeholder="Escribe una respuesta... (Enter para enviar, Shift+Enter para nueva línea)"
                    rows={2}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={!message.trim() || sending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium text-sm shrink-0"
                  >
                    {sending ? '...' : 'Enviar'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* RIGHT COLUMN */}
      <div className="w-64 border-l border-border-primary overflow-y-auto p-4 bg-bg-card shrink-0">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Perfil del huésped</h2>

        {!selected ? (
          <p className="text-sm text-text-tertiary text-center py-8">Selecciona una conversación</p>
        ) : (
          <>
            <div className="text-center mb-4">
              <Avatar name={selected.huesped_nombre} size={60} />
              <p className="font-semibold text-text-primary mt-2">{selected.huesped_nombre}</p>
              {selected.huesped?.segmento_crm && (
                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full text-white font-medium"
                  style={{ background: '#F59E0B' }}>
                  {selected.huesped.segmento_crm}
                </span>
              )}
            </div>

            <div className="space-y-2 text-sm mb-5">
              <div className="flex items-center gap-2 text-text-secondary">
                <span>🛏</span>
                <span>Habitación: <strong>HAB-{selected.habitacion_numero}</strong></span>
              </div>
              {selected.fecha_entrada && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <span>📅</span>
                  <span>Check-in: <strong>{format(parseISO(selected.fecha_entrada), 'dd/MM/yyyy')}</strong></span>
                </div>
              )}
              {selected.fecha_salida && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <span>📅</span>
                  <span>Check-out: <strong>{format(parseISO(selected.fecha_salida), 'dd/MM/yyyy')}</strong></span>
                </div>
              )}
              {selected.huesped?.idioma_preferido && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <span>🌍</span>
                  <span>Idioma: <strong>{selected.huesped.idioma_preferido.toUpperCase()}</strong></span>
                </div>
              )}
            </div>

            <hr className="border-border-primary mb-4" />

            <div className="mb-5">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Preferencias</p>
              {selected.huesped?.preferencias && Object.keys(selected.huesped.preferencias).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(selected.huesped.preferencias).map(([k, v]) => (
                    <span key={k} className="px-2 py-0.5 bg-info-bg text-info text-xs rounded-full border border-info">
                      {v || k}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-tertiary">Sin preferencias registradas</p>
              )}
            </div>

            <hr className="border-border-primary mb-4" />

            <div className="mb-5">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Alertas activas</p>
              {alertas.length === 0 ? (
                <p className="text-xs text-success font-medium">✓ Sin alertas</p>
              ) : (
                <div className="space-y-2">
                  {alertas.map(a => (
                    <div key={a.id} className="bg-danger-bg border border-danger rounded-lg p-2">
                      <p className="text-xs font-semibold text-danger">{a.tipo}</p>
                      <p className="text-xs text-red-600 mt-0.5">{a.descripcion ?? a.mensaje}</p>
                      {a.nivel && <span className="text-xs text-red-500">{a.nivel}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selected.reserva_codigo && (
              <button
                onClick={() => navigate(`/reservas?q=${selected.reserva_codigo}`)}
                className="w-full text-left text-sm text-blue-600 hover:text-info font-medium flex items-center gap-1"
              >
                Ver reserva completa <span>→</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
