import { useState, useEffect, type FormEvent } from 'react'
import api from '../../api/client'

const C = {
  bg: '#070A10', surface: '#0D1017', surface2: '#12171F', surface3: '#1B2131',
  border: 'rgba(255,255,255,0.06)', border2: 'rgba(255,255,255,0.1)',
  text: '#F0F4F8', text2: '#8A9AB5', text3: '#556070',
  green: '#22C55E', blue: '#4D96FF', yellow: '#EAB308', red: '#EF4444',
  gold: '#D4A853',
}

type Plan = 'basico' | 'estandar' | 'premium' | 'empresa'
type Estado = 'activa' | 'suspendida' | 'cancelada' | 'prueba'

interface Pago {
  id: string; monto: number; periodo: string; fecha_pago: string | null
  metodo: string | null; referencia: string | null; estado: string
}

interface Empresa {
  id: string; nombre_comercial: string; subdominio: string; plan: Plan; estado: Estado
  precio_mensual: number; locales_count: number; usuarios_count: number
  fecha_proximo_pago: string; dias_hasta_vencer: number; ultimo_pago: Pago | null
}

interface Dashboard {
  total_empresas: number; empresas_activas: number; empresas_suspendidas: number
  ingresos_mensuales_recurrentes: number
}

const PLAN_LABEL: Record<Plan, string> = { basico: 'Básico', estandar: 'Estándar', premium: 'Premium', empresa: 'Empresa' }

function estadoInfo(e: Empresa): { icon: string; label: string; color: string } {
  if (e.estado === 'suspendida') return { icon: '🔴', label: 'Suspendida', color: C.red }
  if (e.estado === 'cancelada') return { icon: '⚫', label: 'Cancelada', color: C.text3 }
  if (e.estado === 'activa' && e.dias_hasta_vencer <= 3) {
    return { icon: '🟠', label: `Por vencer · ${e.dias_hasta_vencer}d`, color: C.yellow }
  }
  if (e.estado === 'prueba') return { icon: '🔵', label: 'Prueba', color: C.blue }
  return { icon: '🟢', label: 'Activa', color: C.green }
}

const css = `
.pf-root{height:100%;background:${C.bg};color:${C.text};font-family:-apple-system,BlinkMacSystemFont,sans-serif;overflow-y:auto;}
.pf-root *{box-sizing:border-box;}
.pf-hd{display:flex;align-items:center;gap:12px;padding:18px 24px;border-bottom:1px solid ${C.border};background:${C.surface};position:sticky;top:0;z-index:5;}
.pf-title{font-size:18px;font-weight:800;color:${C.text};flex:1;}
.pf-add{display:flex;align-items:center;gap:7px;padding:9px 16px;background:rgba(77,150,255,0.12);border:1px solid rgba(77,150,255,0.25);border-radius:8px;color:${C.blue};font-size:13px;font-weight:700;cursor:pointer;}
.pf-add:hover{background:rgba(77,150,255,0.18);}
.pf-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;padding:20px 24px 0;}
.pf-card{background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:14px 16px;}
.pf-card .k{font-size:11px;color:${C.text3};text-transform:uppercase;letter-spacing:0.04em;}
.pf-card .v{font-size:22px;font-weight:800;color:${C.text};margin-top:4px;}
.pf-table-wrap{padding:20px 24px;overflow-x:auto;}
.pf-table{width:100%;border-collapse:collapse;background:${C.surface};border:1px solid ${C.border};border-radius:12px;overflow:hidden;}
.pf-table th{text-align:left;font-size:11px;color:${C.text3};text-transform:uppercase;letter-spacing:0.04em;padding:10px 14px;background:${C.surface2};border-bottom:1px solid ${C.border};}
.pf-table td{padding:12px 14px;font-size:13px;border-bottom:1px solid ${C.border};color:${C.text2};}
.pf-table tr:last-child td{border-bottom:none;}
.pf-name{color:${C.text};font-weight:700;}
.pf-sub{font-size:11px;color:${C.text3};font-family:monospace;}
.pf-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700;background:${C.surface2};white-space:nowrap;}
.pf-actions{display:flex;gap:6px;flex-wrap:wrap;}
.pf-act-btn{padding:6px 10px;border-radius:7px;border:1px solid ${C.border2};background:transparent;color:${C.text2};font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;}
.pf-act-btn:hover{color:${C.text};border-color:${C.border2};}
.empty{text-align:center;color:${C.text3};font-size:14px;padding:48px;}
.spinner-center{text-align:center;color:${C.text3};font-size:14px;padding:48px;}
.error-center{text-align:center;color:${C.text3};font-size:14px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;}
.retry-btn{padding:8px 16px;background:${C.surface2};border:1px solid ${C.border2};border-radius:8px;color:${C.text};cursor:pointer;font-size:13px;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:24px;width:min(520px,100vw);max-height:85vh;overflow-y:auto;}
.modal-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
.modal-title{font-size:16px;font-weight:700;color:${C.text};}
.sheet-close{background:${C.surface3};border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${C.text2};flex-shrink:0;}
.form-field{margin-bottom:14px;}
.form-label{display:block;font-size:12px;font-weight:600;color:${C.text2};margin-bottom:5px;}
.form-input,.form-select,.form-textarea{width:100%;background:${C.surface2};border:1px solid ${C.border};border-radius:8px;padding:9px 12px;font-size:13px;color:${C.text};outline:none;font-family:inherit;}
.form-input:focus,.form-select:focus,.form-textarea:focus{border-color:${C.border2};}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.form-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
.form-section{font-size:11px;font-weight:800;color:${C.gold};text-transform:uppercase;letter-spacing:0.05em;margin:18px 0 10px;}
.form-section:first-child{margin-top:0;}
.form-warn{font-size:12px;color:${C.yellow};background:rgba(234,179,8,0.08);border-radius:8px;padding:10px 12px;margin-bottom:14px;}
.modal-actions{display:flex;gap:8px;margin-top:20px;}
.modal-cancel{flex:1;padding:10px;border-radius:8px;border:1px solid ${C.border2};background:transparent;color:${C.text2};cursor:pointer;font-size:13px;}
.modal-confirm{flex:1;padding:10px;border-radius:8px;border:none;font-size:13px;font-weight:700;cursor:pointer;background:rgba(77,150,255,0.2);color:${C.blue};}
.modal-confirm.danger{background:rgba(239,68,68,0.15);color:${C.red};}
.modal-confirm:disabled{opacity:0.5;cursor:default;}
.pagos-list{display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto;}
.pago-row{display:flex;justify-content:space-between;align-items:center;background:${C.surface2};border-radius:8px;padding:10px 12px;font-size:12px;}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${C.surface};border:1px solid ${C.border2};border-radius:24px;padding:10px 20px;font-size:13px;color:${C.text};z-index:400;display:flex;align-items:center;gap:8px;box-shadow:0 8px 32px rgba(0,0,0,0.4);}
`

interface FormEmpresa {
  nombre_comercial: string; razon_social: string; ruc: string; email_contacto: string; telefono_contacto: string
  subdominio: string; nombre_sistema: string; plan: Plan; precio_mensual: string
  max_locales: string; max_usuarios: string; max_habitaciones_por_local: string
  admin_nombre: string; admin_email: string; admin_password: string
}

const FORM_EMPTY: FormEmpresa = {
  nombre_comercial: '', razon_social: '', ruc: '', email_contacto: '', telefono_contacto: '',
  subdominio: '', nombre_sistema: 'Hotelia PMS', plan: 'estandar', precio_mensual: '',
  max_locales: '1', max_usuarios: '5', max_habitaciones_por_local: '30',
  admin_nombre: '', admin_email: '', admin_password: '',
}

function generarPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let pass = ''
  for (let i = 0; i < 14; i++) pass += chars[Math.floor(Math.random() * chars.length)]
  return pass
}

function NuevaEmpresaModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (f: FormEmpresa) => Promise<void> }) {
  const [form, setForm] = useState<FormEmpresa>(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof FormEmpresa, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try { await onSubmit(form); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span className="modal-title">+ Nueva empresa</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-section">Datos de la empresa</div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Nombre comercial</label>
              <input className="form-input" required value={form.nombre_comercial} onChange={e => set('nombre_comercial', e.target.value)} placeholder="Hoteles Demo SAC" />
            </div>
            <div className="form-field">
              <label className="form-label">Razón social</label>
              <input className="form-input" value={form.razon_social} onChange={e => set('razon_social', e.target.value)} placeholder="Hoteles Demo S.A.C." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">RUC</label>
              <input className="form-input" value={form.ruc} onChange={e => set('ruc', e.target.value)} placeholder="20123456789" />
            </div>
            <div className="form-field">
              <label className="form-label">Teléfono</label>
              <input className="form-input" value={form.telefono_contacto} onChange={e => set('telefono_contacto', e.target.value)} placeholder="+51 999 999 999" />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Email de contacto</label>
            <input className="form-input" type="email" required value={form.email_contacto} onChange={e => set('email_contacto', e.target.value)} placeholder="contacto@empresa.com" />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Subdominio</label>
              <input className="form-input" required value={form.subdominio} onChange={e => set('subdominio', e.target.value.toLowerCase())} placeholder="hoteles-demo" />
            </div>
            <div className="form-field">
              <label className="form-label">Nombre del sistema (white label)</label>
              <input className="form-input" value={form.nombre_sistema} onChange={e => set('nombre_sistema', e.target.value)} placeholder="Hotelia PMS" />
            </div>
          </div>

          <div className="form-section">Plan y facturación</div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Plan</label>
              <select className="form-select" value={form.plan} onChange={e => set('plan', e.target.value as Plan)}>
                {(Object.keys(PLAN_LABEL) as Plan[]).map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Precio mensual (S/)</label>
              <input className="form-input" type="number" min="0" step="0.01" required value={form.precio_mensual} onChange={e => set('precio_mensual', e.target.value)} placeholder="300" />
            </div>
          </div>
          <div className="form-row3">
            <div className="form-field">
              <label className="form-label">Máx. locales</label>
              <input className="form-input" type="number" min="1" required value={form.max_locales} onChange={e => set('max_locales', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Máx. usuarios</label>
              <input className="form-input" type="number" min="1" required value={form.max_usuarios} onChange={e => set('max_usuarios', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Máx. hab./local</label>
              <input className="form-input" type="number" min="1" required value={form.max_habitaciones_por_local} onChange={e => set('max_habitaciones_por_local', e.target.value)} />
            </div>
          </div>

          <div className="form-section">Cuenta admin de la empresa</div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Nombre del administrador</label>
              <input className="form-input" required value={form.admin_nombre} onChange={e => set('admin_nombre', e.target.value)} placeholder="Juan Pérez" />
            </div>
            <div className="form-field">
              <label className="form-label">Email del administrador</label>
              <input className="form-input" type="email" required value={form.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder="admin@empresa.com" />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Contraseña temporal</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" required minLength={8} value={form.admin_password} onChange={e => set('admin_password', e.target.value)} placeholder="Mínimo 8 caracteres" />
              <button type="button" className="modal-cancel" style={{ flex: '0 0 auto' }} onClick={() => set('admin_password', generarPassword())}>Generar</button>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="modal-confirm" disabled={saving}>{saving ? 'Creando...' : 'Crear empresa'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PagoModal({ empresa, onClose, onSubmit }: {
  empresa: Empresa; onClose: () => void
  onSubmit: (data: { monto: number; periodo: string; fecha_pago: string; metodo: string; referencia: string }) => Promise<void>
}) {
  const hoy = new Date()
  const [monto, setMonto] = useState(String(empresa.precio_mensual))
  const [periodo, setPeriodo] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`)
  const [fechaPago, setFechaPago] = useState(hoy.toISOString().slice(0, 10))
  const [metodo, setMetodo] = useState('Transferencia')
  const [referencia, setReferencia] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try { await onSubmit({ monto: Number(monto), periodo, fecha_pago: fechaPago, metodo, referencia }); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span className="modal-title">Registrar pago · {empresa.nombre_comercial}</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Monto (S/)</label>
              <input className="form-input" type="number" min="0" step="0.01" required value={monto} onChange={e => setMonto(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Período (YYYY-MM)</label>
              <input className="form-input" required value={periodo} onChange={e => setPeriodo(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Fecha de pago</label>
              <input className="form-input" type="date" required value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Método</label>
              <select className="form-select" value={metodo} onChange={e => setMetodo(e.target.value)}>
                <option>Transferencia</option><option>Yape</option><option>Efectivo</option><option>Otro</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Referencia (opcional)</label>
            <input className="form-input" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="N° operación" />
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="modal-confirm" disabled={saving}>{saving ? 'Guardando...' : 'Confirmar pago'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SuspenderModal({ empresa, onClose, onSubmit }: {
  empresa: Empresa; onClose: () => void; onSubmit: (motivo: string) => Promise<void>
}) {
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try { await onSubmit(motivo); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span className="modal-title">Suspender · {empresa.nombre_comercial}</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-warn">⚠ Todos los usuarios de esta empresa no podrán iniciar sesión hasta que se reactive.</div>
        <form onSubmit={submit}>
          <div className="form-field">
            <label className="form-label">Motivo</label>
            <textarea className="form-textarea" rows={3} required value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Explica el motivo de la suspensión..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="modal-confirm danger" disabled={saving}>{saving ? 'Suspendiendo...' : 'Confirmar suspensión'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DetalleModal({ empresa, onClose }: { empresa: Empresa; onClose: () => void }) {
  const [pagos, setPagos] = useState<Pago[] | null>(null)

  useEffect(() => {
    api.get(`/api/v1/plataforma/empresas/${empresa.id}/pagos`)
      .then(r => setPagos(r.data?.data ?? []))
      .catch(() => setPagos([]))
  }, [empresa.id])

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span className="modal-title">{empresa.nombre_comercial}</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-field">
          <span className="form-label">Subdominio</span>
          <div>{empresa.subdominio}.hotelia.com</div>
        </div>
        <div className="form-section">Historial de pagos</div>
        {pagos === null && <div className="spinner-center">Cargando...</div>}
        {pagos?.length === 0 && <div className="empty">Sin pagos registrados</div>}
        {pagos && pagos.length > 0 && (
          <div className="pagos-list">
            {pagos.map(p => (
              <div key={p.id} className="pago-row">
                <span>{p.periodo} · {p.metodo ?? '—'}</span>
                <span style={{ color: C.text }}>S/ {Number(p.monto).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNueva, setShowNueva] = useState(false)
  const [pagoEmpresa, setPagoEmpresa] = useState<Empresa | null>(null)
  const [suspenderEmpresa, setSuspenderEmpresa] = useState<Empresa | null>(null)
  const [detalleEmpresa, setDetalleEmpresa] = useState<Empresa | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2600) }

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const [rEmpresas, rDash] = await Promise.all([
        api.get('/api/v1/plataforma/empresas'),
        api.get('/api/v1/plataforma/dashboard'),
      ])
      setEmpresas(rEmpresas.data?.data ?? [])
      setDash(rDash.data)
    } catch { setError('Error al cargar empresas') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const crear = async (f: FormEmpresa) => {
    await api.post('/api/v1/plataforma/empresas', {
      nombre_comercial: f.nombre_comercial, razon_social: f.razon_social || undefined, ruc: f.ruc || undefined,
      email_contacto: f.email_contacto, telefono_contacto: f.telefono_contacto || undefined,
      subdominio: f.subdominio, nombre_sistema: f.nombre_sistema, plan: f.plan,
      precio_mensual: Number(f.precio_mensual), max_locales: Number(f.max_locales),
      max_usuarios: Number(f.max_usuarios), max_habitaciones_por_local: Number(f.max_habitaciones_por_local),
      admin_nombre: f.admin_nombre, admin_email: f.admin_email, admin_password: f.admin_password,
    })
    showToast('Empresa creada correctamente')
    await cargar()
  }

  const registrarPago = async (empresaId: string, data: { monto: number; periodo: string; fecha_pago: string; metodo: string; referencia: string }) => {
    await api.post(`/api/v1/plataforma/empresas/${empresaId}/pagos`, {
      monto: data.monto, periodo: data.periodo, fecha_pago: data.fecha_pago,
      metodo: data.metodo, referencia: data.referencia || undefined,
    })
    showToast('Pago registrado')
    await cargar()
  }

  const suspender = async (empresaId: string, motivo: string) => {
    await api.patch(`/api/v1/plataforma/empresas/${empresaId}/estado`, { estado: 'suspendida', motivo })
    showToast('Empresa suspendida')
    await cargar()
  }

  const reactivar = async (empresaId: string) => {
    await api.patch(`/api/v1/plataforma/empresas/${empresaId}/estado`, { estado: 'activa' })
    showToast('Empresa reactivada')
    await cargar()
  }

  return (
    <div className="pf-root">
      <style>{css}</style>
      <div className="pf-hd">
        <span className="pf-title">🏢 Panel de Plataforma — Hotelia SaaS</span>
        <button className="pf-add" onClick={() => setShowNueva(true)}>+ Nueva empresa</button>
      </div>

      {dash && (
        <div className="pf-cards">
          <div className="pf-card"><div className="k">Total empresas</div><div className="v">{dash.total_empresas}</div></div>
          <div className="pf-card"><div className="k">Activas</div><div className="v" style={{ color: C.green }}>{dash.empresas_activas}</div></div>
          <div className="pf-card"><div className="k">Suspendidas</div><div className="v" style={{ color: C.red }}>{dash.empresas_suspendidas}</div></div>
          <div className="pf-card"><div className="k">MRR</div><div className="v" style={{ color: C.gold }}>S/ {dash.ingresos_mensuales_recurrentes.toFixed(2)}</div></div>
        </div>
      )}

      {cargando && <div className="spinner-center">Cargando empresas...</div>}
      {error && <div className="error-center"><span>{error}</span><button className="retry-btn" onClick={cargar}>Reintentar</button></div>}

      {!cargando && !error && (
        <div className="pf-table-wrap">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Empresa</th><th>Plan</th><th>Locales</th><th>Usuarios</th><th>Próximo pago</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empresas.length === 0 && (
                <tr><td colSpan={7} className="empty">Sin empresas registradas</td></tr>
              )}
              {empresas.map(e => {
                const info = estadoInfo(e)
                return (
                  <tr key={e.id}>
                    <td>
                      <div className="pf-name">{e.nombre_comercial}</div>
                      <div className="pf-sub">{e.subdominio}.hotelia.com</div>
                    </td>
                    <td>{PLAN_LABEL[e.plan]}</td>
                    <td>{e.locales_count}</td>
                    <td>{e.usuarios_count}</td>
                    <td>{new Date(e.fecha_proximo_pago).toLocaleDateString('es-PE')}</td>
                    <td><span className="pf-badge" style={{ color: info.color }}>{info.icon} {info.label}</span></td>
                    <td>
                      <div className="pf-actions">
                        <button className="pf-act-btn" onClick={() => setDetalleEmpresa(e)}>Ver detalle</button>
                        <button className="pf-act-btn" onClick={() => setPagoEmpresa(e)}>Registrar pago</button>
                        {e.estado === 'suspendida'
                          ? <button className="pf-act-btn" onClick={() => reactivar(e.id)}>Reactivar</button>
                          : <button className="pf-act-btn" onClick={() => setSuspenderEmpresa(e)}>Suspender</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNueva && <NuevaEmpresaModal onClose={() => setShowNueva(false)} onSubmit={crear} />}
      {pagoEmpresa && (
        <PagoModal empresa={pagoEmpresa} onClose={() => setPagoEmpresa(null)} onSubmit={d => registrarPago(pagoEmpresa.id, d)} />
      )}
      {suspenderEmpresa && (
        <SuspenderModal empresa={suspenderEmpresa} onClose={() => setSuspenderEmpresa(null)} onSubmit={motivo => suspender(suspenderEmpresa.id, motivo)} />
      )}
      {detalleEmpresa && <DetalleModal empresa={detalleEmpresa} onClose={() => setDetalleEmpresa(null)} />}

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
