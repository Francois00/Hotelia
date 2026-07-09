import { useState } from 'react'
import api from '../api/client'

type CanalNombre = 'booking' | 'expedia' | 'whatsapp' | 'web'

interface Props {
  canal: CanalNombre
  onClose: () => void
  onSuccess: () => void
}

const TITLES: Record<CanalNombre, string> = {
  booking:  'Booking.com',
  expedia:  'Expedia',
  whatsapp: 'WhatsApp Business',
  web:      'Web propia',
}

export default function ModalConfigCanal({ canal, onClose, onSuccess }: Props) {
  const [form, setForm]         = useState<Record<string, string>>({})
  const [testing, setTesting]   = useState(false)
  const [testResult, setTest]   = useState<{ ok: boolean; msg: string } | null>(null)
  const [saving, setSaving]     = useState(false)

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleTest = async () => {
    setTesting(true)
    setTest(null)
    try {
      await api.post(`/api/v1/channel-manager/canales/${canal}/test`, form)
      setTest({ ok: true, msg: 'Conexión exitosa' })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Endpoint de prueba no disponible aún'
      setTest({ ok: false, msg })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Persiste en localStorage hasta que el backend tenga endpoint de config
      localStorage.setItem(`canal_config_${canal}`, JSON.stringify(form))
      onSuccess()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border-primary flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Configurar {TITLES[canal]}</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary text-2xl leading-none">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {canal === 'booking' && (
            <>
              <Field label="Hotel ID"       value={form.hotel_id ?? ''}    onChange={v => set('hotel_id', v)}    placeholder="12345" />
              <Field label="Username API"   value={form.username ?? ''}    onChange={v => set('username', v)}    placeholder="hotel-username" />
              <Field label="Password API"   value={form.password ?? ''}    onChange={v => set('password', v)}    type="password" placeholder="••••••••" />
              <Field label="URL Webhook"    value={form.webhook_url ?? ''} onChange={v => set('webhook_url', v)} placeholder="https://mi-hotel.com/api/v1/canales/webhook/booking" />
            </>
          )}

          {canal === 'expedia' && (
            <>
              <Field label="EQC Partner ID" value={form.partner_id ?? ''}  onChange={v => set('partner_id', v)}  placeholder="EXP-12345" />
              <Field label="Username"       value={form.username ?? ''}    onChange={v => set('username', v)}    placeholder="hotel-username" />
              <Field label="Password"       value={form.password ?? ''}    onChange={v => set('password', v)}    type="password" placeholder="••••••••" />
              <Field label="Property ID"   value={form.property_id ?? ''} onChange={v => set('property_id', v)} placeholder="67890" />
            </>
          )}

          {canal === 'whatsapp' && (
            <div className="space-y-4">
              <div className="bg-info-bg border border-info rounded-xl px-4 py-3 text-sm text-info">
                ℹ️ Si el Concierge IA ya está funcionando, el WhatsApp Business está configurado correctamente.
                Estos campos solo son necesarios si quieres apuntar a un número distinto.
              </div>
              <Field label="Phone Number ID" value={form.phone_number_id ?? ''} onChange={v => set('phone_number_id', v)} placeholder="123456789012345" />
              <Field label="Access Token"    value={form.access_token ?? ''}    onChange={v => set('access_token', v)}    type="password" placeholder="EAAxxxxxxx..." />
              <Field label="Webhook Secret"  value={form.webhook_secret ?? ''}  onChange={v => set('webhook_secret', v)}  type="password" placeholder="mi-secreto-hmac" />
            </div>
          )}

          {canal === 'web' && (
            <div className="bg-bg-secondary rounded-xl px-4 py-8 text-sm text-text-secondary text-center space-y-2">
              <p className="text-3xl">🌐</p>
              <p className="font-semibold text-gray-800">Motor de reservas propio</p>
              <p>Tu motor de reservas usa la misma API del PMS. No requiere configuración adicional.</p>
              <p className="text-xs text-text-tertiary mt-2">
                Endpoint: <code className="bg-bg-card px-1 py-0.5 rounded border">POST /api/v1/reservas</code>
              </p>
            </div>
          )}

          {canal !== 'web' && (
            <>
              {testResult && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${
                  testResult.ok
                    ? 'bg-success-bg text-success border-success'
                    : 'bg-danger-bg text-danger border-danger'
                }`}>
                  {testResult.ok ? '✅' : '❌'} {testResult.msg}
                </div>
              )}
              <button
                onClick={() => void handleTest()}
                disabled={testing}
                className="w-full py-2 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-bg-secondary disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {testing && (
                  <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                )}
                Probar conexión
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-primary flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
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
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}
