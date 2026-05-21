import { useState, useRef, useEffect } from 'react'
import api from '../api/client'

interface Message {
  role: 'user' | 'bot'
  text: string
  tiempo_ms?: number
  paso?: string
  ts: number
}

const QUICK_MESSAGES = [
  'Hola, quiero reservar',
  'del 25 al 27 de mayo',
  '2 personas',
  '1',
  'Carlos Rios García',
  '45123456',
  'SI',
]

function newSessionId(): string {
  return 'web_' + Math.random().toString(36).slice(2, 10)
}

const BOT_WELCOME: Message = {
  role: 'bot',
  text: '¡Hola! Soy el Concierge IA del Hotel Hotelia. Puedes enviarme cualquier consulta como si fueras un huésped de WhatsApp. Estoy conectado a Llama3 con datos reales de habitaciones disponibles.',
  ts: Date.now(),
}

export default function ConciergeTestPage() {
  const [sessionId, setSessionId] = useState<string>(newSessionId)
  const [messages,  setMessages]  = useState<Message[]>([BOT_WELCOME])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleNuevaSesion = async () => {
    const newId = newSessionId()
    // Reset session on backend too (best-effort)
    try { await api.delete(`/api/v1/concierge/chat/${sessionId}`) } catch { /* ignore */ }
    setSessionId(newId)
    setMessages([BOT_WELCOME])
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setMessages(prev => [...prev, { role: 'user', text: trimmed, ts: Date.now() }])
    setInput('')
    setLoading(true)

    try {
      const resp = await api.post<{
        respuesta: string
        modelo: string
        tiempo_ms: number
        paso_actual: string
        session_id: string
      }>(
        '/api/v1/concierge/chat',
        { mensaje: trimmed, session_id: sessionId },
      )
      setMessages(prev => [
        ...prev,
        {
          role:      'bot',
          text:      resp.data.respuesta,
          tiempo_ms: resp.data.tiempo_ms,
          paso:      resp.data.paso_actual,
          ts:        Date.now(),
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'bot', text: 'Error al conectar con el servidor. Verifica que Ollama esté corriendo.', ts: Date.now() },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-full max-h-screen p-6 gap-4">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white text-lg">🤖</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Prueba Concierge IA</h1>
            <p className="text-xs text-gray-500">
              Modelo: llama3 · localhost:11434 · session: <code className="font-mono">{sessionId}</code>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Llama3 activo
            </span>
            <button
              onClick={() => void handleNuevaSesion()}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-600 rounded-full hover:bg-gray-50 transition-colors"
            >
              Nueva sesión
            </button>
          </div>
        </div>
      </div>

      {/* Quick messages */}
      <div className="shrink-0 flex flex-wrap gap-2">
        {QUICK_MESSAGES.map(qm => (
          <button
            key={qm}
            onClick={() => void sendMessage(qm)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium border border-purple-200 text-purple-700 rounded-full hover:bg-purple-50 disabled:opacity-40 transition-colors"
          >
            {qm}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'bot' && (
              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-sm mr-2 shrink-0 mt-0.5">🤖</div>
            )}
            <div className={`max-w-[75%] ${m.role === 'user' ? 'order-first' : ''}`}>
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                {m.text}
              </div>
              {m.role === 'bot' && m.tiempo_ms !== undefined && (
                <p className="text-xs text-gray-400 mt-1 px-1">
                  {m.tiempo_ms.toLocaleString()} ms · llama3
                  {m.paso && <span className="ml-2 text-purple-400">· {m.paso}</span>}
                </p>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white ml-2 shrink-0 mt-0.5">Tú</div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-sm mr-2 shrink-0">🤖</div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Escribe un mensaje como si fueras un huésped de WhatsApp..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
        />
        <button
          onClick={() => void sendMessage(input)}
          disabled={loading || !input.trim()}
          className="px-5 py-3 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-colors"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
