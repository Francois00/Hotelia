import { useState, useEffect, type FormEvent } from 'react'
import api from '../api/client'
import { useRol } from '../hooks/useRol'

// Paleta ligada a los theme tokens (theme.css) — cambia sola con [data-theme].
const C = {
  bg: 'var(--bg-primary)', surface: 'var(--bg-secondary)', surface2: 'var(--bg-card)', surface3: 'var(--bg-tertiary)',
  border: 'var(--border-primary)', border2: 'var(--border-secondary)',
  text: 'var(--text-primary)', text2: 'var(--text-secondary)', text3: 'var(--text-tertiary)',
  green: 'var(--estado-disponible)', blue: 'var(--estado-ocupada)', yellow: 'var(--estado-limpieza)', red: 'var(--estado-mantenimiento)',
  gold: 'var(--brand-accent)',
}

type Seccion = 'datos' | 'horarios' | 'pagos' | 'facturacion' | 'whatsapp' | 'personal' | 'notificaciones' | 'seguridad'

const SECS: { id: Seccion; label: string; icon: string }[] = [
  { id: 'datos', label: 'Datos del hotel', icon: '🏨' },
  { id: 'horarios', label: 'Horarios', icon: '🕐' },
  { id: 'pagos', label: 'Pagos', icon: '💳' },
  { id: 'facturacion', label: 'Facturación', icon: '📄' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '📱' },
  { id: 'personal', label: 'Personal', icon: '👥' },
  { id: 'notificaciones', label: 'Notificaciones', icon: '🔔' },
  { id: 'seguridad', label: 'Seguridad', icon: '🔒' },
]

interface Config {
  nombre?: string; ruc?: string; direccion?: string; ciudad?: string; pais?: string; telefono?: string; email?: string; web?: string
  hora_checkin?: string; hora_checkout?: string; hora_checkout_tarde?: string; cargo_checkout_tarde?: number
  moneda?: string; pasarela?: string; niubiz_merchant?: string; niubiz_token?: string
  ruc_emisor?: string; razon_social?: string; tipo_comprobante?: string; serie_factura?: string; serie_boleta?: string
  wa_numero?: string; wa_saludo?: string; wa_confirmacion?: boolean; wa_recordatorio?: boolean; wa_checkout?: boolean
  notif_email_nueva_reserva?: boolean; notif_email_cancelacion?: boolean; notif_sms?: boolean
  [key: string]: string | number | boolean | undefined
}

const css = `
.cfg-root{display:flex;height:100%;background:${C.bg};color:${C.text};font-family:-apple-system,BlinkMacSystemFont,sans-serif;}
.cfg-root *{box-sizing:border-box;}
.cfg-sidebar{width:200px;min-width:200px;background:${C.surface};border-right:1px solid ${C.border};display:flex;flex-direction:column;overflow:hidden;}
.cfg-sid-hd{padding:16px 14px;border-bottom:1px solid ${C.border};font-size:11px;font-weight:700;color:${C.text3};text-transform:uppercase;letter-spacing:0.06em;}
.cfg-sid-list{flex:1;overflow-y:auto;padding:8px;}
.cfg-sid-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;margin-bottom:2px;border:1px solid transparent;}
.cfg-sid-item:hover{background:${C.surface2};}
.cfg-sid-item.on{background:rgba(77,150,255,0.08);border-color:rgba(77,150,255,0.2);}
.cfg-sid-ic{font-size:16px;flex-shrink:0;}
.cfg-sid-label{font-size:13px;font-weight:500;color:${C.text};}
.cfg-sid-item.on .cfg-sid-label{color:${C.blue};}
.cfg-main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.cfg-main-hd{display:flex;align-items:center;gap:12px;padding:14px 20px;background:${C.surface};border-bottom:1px solid ${C.border};flex-shrink:0;}
.cfg-main-title{font-size:16px;font-weight:800;color:${C.text};flex:1;}
.save-btn{display:flex;align-items:center;gap:7px;padding:9px 18px;background:rgba(212,168,83,0.15);border:1px solid rgba(212,168,83,0.3);border-radius:8px;color:${C.gold};font-size:13px;font-weight:700;cursor:pointer;}
.save-btn:hover{background:rgba(212,168,83,0.2);}
.save-btn:disabled{opacity:0.5;cursor:default;}
.cfg-body{flex:1;overflow-y:auto;padding:24px;}
.section{max-width:680px;}
.form-group{margin-bottom:24px;}
.group-title{font-size:13px;font-weight:700;color:${C.text2};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid ${C.border};}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.form-grid.single{grid-template-columns:1fr;}
.form-field{display:flex;flex-direction:column;gap:5px;}
.form-field.full{grid-column:1/-1;}
.form-label{font-size:12px;font-weight:600;color:${C.text2};}
.form-input{background:${C.surface2};border:1px solid ${C.border};border-radius:8px;padding:9px 12px;font-size:13px;color:${C.text};outline:none;width:100%;}
.form-input:focus{border-color:${C.border2};}
.form-input::placeholder{color:${C.text3};}
.form-input:disabled{opacity:0.5;}
.form-select{background:${C.surface2};border:1px solid ${C.border};border-radius:8px;padding:9px 12px;font-size:13px;color:${C.text};outline:none;width:100%;}
.form-select:focus{border-color:${C.border2};}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:${C.surface2};border:1px solid ${C.border};border-radius:8px;}
.toggle-info{}.toggle-name{font-size:13px;font-weight:600;color:${C.text};}
.toggle-desc{font-size:11px;color:${C.text3};margin-top:2px;}
.toggle-wrap{position:relative;width:44px;height:24px;flex-shrink:0;}
.toggle-wrap input{opacity:0;width:0;height:0;position:absolute;}
.toggle-track{width:44px;height:24px;border-radius:12px;background:${C.surface3};cursor:pointer;transition:background 0.2s;display:block;}
.toggle-wrap input:checked + .toggle-track{background:${C.green};}
.toggle-thumb{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:${C.text};pointer-events:none;transition:left 0.2s;}
.toggle-wrap input:checked ~ .toggle-thumb{left:23px;}
.radio-group{display:flex;gap:8px;}
.radio-opt{display:flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid ${C.border};border-radius:8px;cursor:pointer;flex:1;font-size:13px;color:${C.text2};}
.radio-opt.on{border-color:rgba(77,150,255,0.4);background:rgba(77,150,255,0.06);color:${C.blue};}
.radio-ic{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.radio-dot{width:8px;height:8px;border-radius:50%;background:currentColor;}
.pwd-wrap{position:relative;}
.pwd-wrap input{padding-right:40px;}
.pwd-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);cursor:pointer;color:${C.text3};background:none;border:none;font-size:16px;}
.save-success{display:flex;align-items:center;gap:6px;padding:10px 16px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:8px;font-size:13px;color:${C.green};margin-bottom:16px;}
.spinner-center{display:flex;align-items:center;justify-content:center;flex:1;color:${C.text3};font-size:14px;}
.error-center{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:12px;color:${C.text3};font-size:14px;}
.retry-btn{padding:8px 16px;background:${C.surface2};border:1px solid ${C.border2};border-radius:8px;color:${C.text};cursor:pointer;font-size:13px;}
.staff-table{width:100%;border-collapse:collapse;}
.staff-table th{padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:${C.text3};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid ${C.border};}
.staff-table td{padding:11px 12px;border-bottom:1px solid ${C.border};font-size:13px;color:${C.text};}
.role-chip{display:inline-flex;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;}
.role-chip.gerente{background:rgba(212,168,83,0.12);color:${C.gold};}.role-chip.recepcionista{background:rgba(77,150,255,0.12);color:${C.blue};}.role-chip.housekeeping{background:rgba(34,197,94,0.1);color:${C.green};}.role-chip.mantenimiento{background:rgba(239,68,68,0.1);color:${C.red};}
`

// ─── Field helpers ─────────────────────────────────────────────────────────────
function Field({ label, name, value, onChange, placeholder, type = 'text', disabled = false }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void
  placeholder?: string; type?: string; disabled?: boolean
}) {
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} name={name} value={value} placeholder={placeholder} disabled={disabled}
        onChange={e => onChange(name, e.target.value)} />
    </div>
  )
}

function SelectField({ label, name, value, onChange, options }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      <select className="form-select" name={name} value={value} onChange={e => onChange(name, e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function Toggle({ label, desc, name, value, onChange }: { label: string; desc?: string; name: string; value: boolean; onChange: (n: string, v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <div className="toggle-info">
        <div className="toggle-name">{label}</div>
        {desc && <div className="toggle-desc">{desc}</div>}
      </div>
      <div className="toggle-wrap" onClick={() => onChange(name, !value)}>
        <input type="checkbox" checked={value} readOnly />
        <span className="toggle-track" />
        <span className="toggle-thumb" />
      </div>
    </div>
  )
}

function RadioGroup({ label, name, value, options, onChange }: {
  label: string; name: string; value: string; options: { value: string; label: string }[]; onChange: (n: string, v: string) => void
}) {
  return (
    <div className="form-field full">
      <label className="form-label">{label}</label>
      <div className="radio-group">
        {options.map(o => (
          <div key={o.value} className={`radio-opt${value === o.value ? ' on' : ''}`} onClick={() => onChange(name, o.value)}>
            <div className="radio-ic">{value === o.value && <div className="radio-dot" />}</div>
            {o.label}
          </div>
        ))}
      </div>
    </div>
  )
}

interface Staff { id: string; nombre: string; email: string; rol: string; activo: boolean }

// ─── Sections ─────────────────────────────────────────────────────────────────
function DatosSection({ cfg, onChange }: { cfg: Config; onChange: (n: string, v: string | boolean | number) => void }) {
  const s = (k: string, v: string) => onChange(k, v)
  return (
    <div className="section">
      <div className="form-group">
        <div className="group-title">Información general</div>
        <div className="form-grid">
          <Field label="Nombre del hotel" name="nombre" value={cfg.nombre ?? ''} onChange={s} placeholder="Hotel Paraíso" />
          <Field label="RUC" name="ruc" value={cfg.ruc ?? ''} onChange={s} placeholder="20123456789" />
          <Field label="Teléfono" name="telefono" value={cfg.telefono ?? ''} onChange={s} placeholder="+51 1 234 5678" />
          <Field label="Email" name="email" value={cfg.email ?? ''} onChange={s} placeholder="recepcion@hotel.com" type="email" />
          <div className="form-field full">
            <Field label="Dirección" name="direccion" value={cfg.direccion ?? ''} onChange={s} placeholder="Av. Principal 123" />
          </div>
          <Field label="Ciudad" name="ciudad" value={cfg.ciudad ?? ''} onChange={s} placeholder="Lima" />
          <SelectField label="País" name="pais" value={cfg.pais ?? 'PE'} onChange={s} options={[{ value: 'PE', label: 'Perú' }, { value: 'CO', label: 'Colombia' }, { value: 'MX', label: 'México' }, { value: 'AR', label: 'Argentina' }]} />
          <Field label="Sitio web" name="web" value={cfg.web ?? ''} onChange={s} placeholder="https://hotel.com" />
        </div>
      </div>
    </div>
  )
}

function HorariosSection({ cfg, onChange }: { cfg: Config; onChange: (n: string, v: string | boolean | number) => void }) {
  const s = (k: string, v: string) => onChange(k, v)
  return (
    <div className="section">
      <div className="form-group">
        <div className="group-title">Horarios estándar</div>
        <div className="form-grid">
          <Field label="Hora de check-in" name="hora_checkin" value={cfg.hora_checkin ?? '15:00'} onChange={s} type="time" />
          <Field label="Hora de check-out" name="hora_checkout" value={cfg.hora_checkout ?? '12:00'} onChange={s} type="time" />
          <Field label="Checkout tardío hasta" name="hora_checkout_tarde" value={cfg.hora_checkout_tarde ?? '18:00'} onChange={s} type="time" />
          <Field label="Cargo checkout tardío (S/)" name="cargo_checkout_tarde" value={String(cfg.cargo_checkout_tarde ?? 50)} onChange={s} type="number" placeholder="50" />
        </div>
      </div>
    </div>
  )
}

function PagosSection({ cfg, onChange }: { cfg: Config; onChange: (n: string, v: string | boolean | number) => void }) {
  const s = (k: string, v: string) => onChange(k, v)
  return (
    <div className="section">
      <div className="form-group">
        <div className="group-title">Configuración de pagos</div>
        <div className="form-grid">
          <SelectField label="Moneda principal" name="moneda" value={cfg.moneda ?? 'PEN'} onChange={s} options={[{ value: 'PEN', label: 'Sol peruano (PEN)' }, { value: 'USD', label: 'Dólar (USD)' }, { value: 'EUR', label: 'Euro (EUR)' }]} />
          <SelectField label="Pasarela de pago" name="pasarela" value={cfg.pasarela ?? 'niubiz'} onChange={s} options={[{ value: 'niubiz', label: 'Niubiz' }, { value: 'izipay', label: 'Izipay' }, { value: 'culqi', label: 'Culqi' }, { value: 'manual', label: 'Solo efectivo' }]} />
        </div>
        {cfg.pasarela === 'niubiz' && (
          <div className="form-grid" style={{ marginTop: 12 }}>
            <Field label="Merchant ID (Niubiz)" name="niubiz_merchant" value={cfg.niubiz_merchant ?? ''} onChange={s} placeholder="510000001" />
            <Field label="Token secreto" name="niubiz_token" value={cfg.niubiz_token ?? ''} onChange={s} placeholder="●●●●●●●●" type="password" />
          </div>
        )}
      </div>
    </div>
  )
}

function FacturacionSection({ cfg, onChange }: { cfg: Config; onChange: (n: string, v: string | boolean | number) => void }) {
  const s = (k: string, v: string) => onChange(k, v)
  return (
    <div className="section">
      <div className="form-group">
        <div className="group-title">Datos de facturación electrónica (SUNAT)</div>
        <div className="form-grid">
          <Field label="RUC emisor" name="ruc_emisor" value={cfg.ruc_emisor ?? cfg.ruc ?? ''} onChange={s} placeholder="20123456789" />
          <Field label="Razón social" name="razon_social" value={cfg.razon_social ?? ''} onChange={s} placeholder="HOTEL PARAÍSO S.A.C." />
          <RadioGroup label="Tipo de comprobante por defecto" name="tipo_comprobante" value={cfg.tipo_comprobante ?? 'boleta'} onChange={s}
            options={[{ value: 'boleta', label: 'Boleta' }, { value: 'factura', label: 'Factura' }, { value: 'ambos', label: 'Cliente elige' }]} />
          <Field label="Serie factura" name="serie_factura" value={cfg.serie_factura ?? 'F001'} onChange={s} placeholder="F001" />
          <Field label="Serie boleta" name="serie_boleta" value={cfg.serie_boleta ?? 'B001'} onChange={s} placeholder="B001" />
        </div>
      </div>
    </div>
  )
}

function WhatsAppSection({ cfg, onChange }: { cfg: Config; onChange: (n: string, v: string | boolean | number) => void }) {
  const s = (k: string, v: string) => onChange(k, v)
  const t = (k: string, v: boolean) => onChange(k, v)
  return (
    <div className="section">
      <div className="form-group">
        <div className="group-title">Conexión WhatsApp Business</div>
        <div className="form-grid single">
          <Field label="Número WhatsApp Business" name="wa_numero" value={cfg.wa_numero ?? ''} onChange={s} placeholder="+51987654321" />
          <Field label="Mensaje de saludo" name="wa_saludo" value={cfg.wa_saludo ?? ''} onChange={s} placeholder="Hola, ¿en qué podemos ayudarte?" />
        </div>
      </div>
      <div className="form-group">
        <div className="group-title">Automatizaciones activas</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Toggle label="Confirmación de reserva" desc="Enviar confirmación por WhatsApp al crear reserva" name="wa_confirmacion" value={!!cfg.wa_confirmacion} onChange={t} />
          <Toggle label="Recordatorio de llegada" desc="Aviso 24h antes del check-in" name="wa_recordatorio" value={!!cfg.wa_recordatorio} onChange={t} />
          <Toggle label="Encuesta post-checkout" desc="Solicitar valoración tras el check-out" name="wa_checkout" value={!!cfg.wa_checkout} onChange={t} />
        </div>
      </div>
    </div>
  )
}

function PersonalSection() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api.get('/api/v1/usuarios?limit=50').then(r => {
      setStaff(r.data?.data ?? r.data ?? [])
    }).catch(() => {}).finally(() => setCargando(false))
  }, [])

  const roleChipClass = (rol: string) => {
    if (rol === 'gerente' || rol === 'admin') return 'gerente'
    if (rol === 'recepcionista') return 'recepcionista'
    if (rol === 'housekeeping') return 'housekeeping'
    return 'mantenimiento'
  }

  if (cargando) return <div className="spinner-center">Cargando personal...</div>

  return (
    <div className="section">
      <table className="staff-table">
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th></tr></thead>
        <tbody>
          {staff.length === 0 && <tr><td colSpan={4} style={{ color: C.text3, textAlign: 'center', padding: 24 }}>Sin usuarios registrados</td></tr>}
          {staff.map(u => (
            <tr key={u.id}>
              <td style={{ fontWeight: 600 }}>{u.nombre}</td>
              <td style={{ color: C.text3 }}>{u.email}</td>
              <td><span className={`role-chip ${roleChipClass(u.rol)}`}>{u.rol}</span></td>
              <td><span style={{ color: u.activo ? C.green : C.text3, fontSize: 12, fontWeight: 600 }}>{u.activo ? '● Activo' : '○ Inactivo'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NotificacionesSection({ cfg, onChange }: { cfg: Config; onChange: (n: string, v: string | boolean | number) => void }) {
  const t = (k: string, v: boolean) => onChange(k, v)
  return (
    <div className="section">
      <div className="form-group">
        <div className="group-title">Notificaciones por email</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Toggle label="Nueva reserva" desc="Recibir email al confirmar nueva reserva" name="notif_email_nueva_reserva" value={!!cfg.notif_email_nueva_reserva} onChange={t} />
          <Toggle label="Cancelación" desc="Avisar por email cuando se cancele una reserva" name="notif_email_cancelacion" value={!!cfg.notif_email_cancelacion} onChange={t} />
          <Toggle label="SMS (Twilio)" desc="Notificaciones urgentes por SMS al gerente" name="notif_sms" value={!!cfg.notif_sms} onChange={t} />
        </div>
      </div>
    </div>
  )
}

function SeguridadSection() {
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ old_pw: '', new_pw: '', confirm_pw: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.new_pw !== form.confirm_pw) { setMsg({ type: 'err', text: 'Las contraseñas no coinciden' }); return }
    setSaving(true)
    try {
      await api.put('/api/v1/auth/cambiar-password', { password_actual: form.old_pw, password_nuevo: form.new_pw })
      setMsg({ type: 'ok', text: 'Contraseña actualizada correctamente' })
      setForm({ old_pw: '', new_pw: '', confirm_pw: '' })
    } catch { setMsg({ type: 'err', text: 'Error al cambiar contraseña' }) }
    finally { setSaving(false) }
  }

  return (
    <div className="section">
      <div className="form-group">
        <div className="group-title">Cambiar contraseña</div>
        {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 14, background: msg.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: msg.type === 'ok' ? C.green : C.red }}>{msg.text}</div>}
        <form onSubmit={submit}>
          <div className="form-grid single">
            <div className="form-field">
              <label className="form-label">Contraseña actual</label>
              <div className="pwd-wrap">
                <input className="form-input" type={showOld ? 'text' : 'password'} value={form.old_pw} onChange={e => setForm(f => ({ ...f, old_pw: e.target.value }))} placeholder="●●●●●●●●" />
                <button type="button" className="pwd-eye" onClick={() => setShowOld(v => !v)}>{showOld ? '🙈' : '👁'}</button>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Nueva contraseña</label>
              <div className="pwd-wrap">
                <input className="form-input" type={showNew ? 'text' : 'password'} value={form.new_pw} onChange={e => setForm(f => ({ ...f, new_pw: e.target.value }))} placeholder="Mínimo 8 caracteres" />
                <button type="button" className="pwd-eye" onClick={() => setShowNew(v => !v)}>{showNew ? '🙈' : '👁'}</button>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Confirmar nueva contraseña</label>
              <input className="form-input" type="password" value={form.confirm_pw} onChange={e => setForm(f => ({ ...f, confirm_pw: e.target.value }))} placeholder="Repetir contraseña" />
            </div>
          </div>
          <button type="submit" disabled={saving} style={{ marginTop: 16, padding: '10px 20px', background: 'rgba(77,150,255,0.12)', border: '1px solid rgba(77,150,255,0.25)', borderRadius: 8, color: C.blue, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Guardando...' : '🔒 Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ConfiguracionPage() {
  const { esNivelAlto: isGerente } = useRol()
  const [seccion, setSeccion] = useState<Seccion>('datos')
  const [cfg, setCfg] = useState<Config>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const r = await api.get('/api/v1/configuracion')
      setCfg(r.data?.data ?? r.data ?? {})
    } catch { setError('Error al cargar configuración') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const onChange = (name: string, value: string | boolean | number) => {
    setCfg(c => ({ ...c, [name]: value }))
    setSavedOk(false)
  }

  const onSave = async () => {
    setSaving(true)
    try {
      await api.put('/api/v1/configuracion', cfg)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  if (!isGerente) return <div style={{ padding: 40, color: C.text3, textAlign: 'center', fontSize: 14 }}>Solo el gerente puede acceder a esta sección.</div>

  return (
    <div className="cfg-root" style={{ height: '100%' }}>
      <style>{css}</style>

      <nav className="cfg-sidebar">
        <div className="cfg-sid-hd">Configuración</div>
        <div className="cfg-sid-list">
          {SECS.map(s => (
            <div key={s.id} className={`cfg-sid-item${seccion === s.id ? ' on' : ''}`} onClick={() => setSeccion(s.id)}>
              <span className="cfg-sid-ic">{s.icon}</span>
              <span className="cfg-sid-label">{s.label}</span>
            </div>
          ))}
        </div>
      </nav>

      <div className="cfg-main">
        <div className="cfg-main-hd">
          <span className="cfg-main-title">{SECS.find(s => s.id === seccion)?.label}</span>
          {seccion !== 'personal' && seccion !== 'seguridad' && (
            <button className="save-btn" onClick={onSave} disabled={saving}>{saving ? 'Guardando...' : '💾 Guardar cambios'}</button>
          )}
        </div>

        <div className="cfg-body">
          {cargando && <div className="spinner-center">Cargando...</div>}
          {error && <div className="error-center"><span>{error}</span><button className="retry-btn" onClick={cargar}>Reintentar</button></div>}

          {!cargando && !error && (
            <>
              {savedOk && <div className="save-success">✓ Configuración guardada correctamente</div>}
              {seccion === 'datos' && <DatosSection cfg={cfg} onChange={onChange} />}
              {seccion === 'horarios' && <HorariosSection cfg={cfg} onChange={onChange} />}
              {seccion === 'pagos' && <PagosSection cfg={cfg} onChange={onChange} />}
              {seccion === 'facturacion' && <FacturacionSection cfg={cfg} onChange={onChange} />}
              {seccion === 'whatsapp' && <WhatsAppSection cfg={cfg} onChange={onChange} />}
              {seccion === 'personal' && <PersonalSection />}
              {seccion === 'notificaciones' && <NotificacionesSection cfg={cfg} onChange={onChange} />}
              {seccion === 'seguridad' && <SeguridadSection />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
