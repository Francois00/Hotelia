import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

const C = {
  bg: 'var(--bg-primary)', surface: 'var(--bg-secondary)', surface2: 'var(--bg-card)', surface3: 'var(--bg-tertiary)',
  border: 'var(--border-primary)', border2: 'var(--border-secondary)',
  text: 'var(--text-primary)', text2: 'var(--text-secondary)', text3: 'var(--text-tertiary)',
  green: 'var(--estado-disponible)', blue: 'var(--estado-ocupada)', yellow: 'var(--estado-limpieza)', red: 'var(--estado-mantenimiento)',
  gold: 'var(--brand-accent)',
}

type Estado = 'nuevo' | 'contactado' | 'demo_agendada' | 'en_prueba' | 'negociacion' | 'convertido' | 'perdido'

const COLUMNAS: { estado: Estado; label: string }[] = [
  { estado: 'nuevo', label: 'Nuevo' },
  { estado: 'contactado', label: 'Contactado' },
  { estado: 'demo_agendada', label: 'Demo agendada' },
  { estado: 'en_prueba', label: 'En prueba' },
  { estado: 'negociacion', label: 'Negociación' },
  { estado: 'convertido', label: 'Convertido' },
]

interface Lead {
  id: string
  nombre_contacto: string
  nombre_empresa: string | null
  telefono: string | null
  email: string | null
  origen: string | null
  estado: Estado | 'perdido'
  empresa_id: string | null
  valor_estimado: number | null
  notas: string | null
  proxima_accion: string | null
  proxima_accion_fecha: string | null
  created_at: string
}

interface Interaccion {
  id: string
  tipo: 'llamada' | 'email' | 'whatsapp' | 'reunion' | 'nota'
  descripcion: string
  created_at: string
}

const TIPO_ICONO: Record<Interaccion['tipo'], string> = {
  llamada: '📞', email: '✉️', whatsapp: '💬', reunion: '🤝', nota: '📝',
}

const css = `
.crm-root{height:100%;background:${C.bg};color:${C.text};font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;flex-direction:column;}
.crm-root *{box-sizing:border-box;}
.crm-hd{display:flex;align-items:center;gap:12px;padding:18px 24px;border-bottom:1px solid ${C.border};background:${C.surface};}
.crm-title{font-size:18px;font-weight:800;color:${C.text};flex:1;}
.crm-btn{display:flex;align-items:center;gap:7px;padding:9px 16px;background:rgba(77,150,255,0.12);border:1px solid rgba(77,150,255,0.25);border-radius:8px;color:${C.blue};font-size:13px;font-weight:700;cursor:pointer;}
.crm-btn:hover{background:rgba(77,150,255,0.18);}
.crm-back{padding:9px 16px;border-radius:8px;border:1px solid ${C.border2};background:transparent;color:${C.text2};font-size:13px;font-weight:600;cursor:pointer;}
.crm-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:20px 24px 0;}
.crm-card-stat{background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:14px 16px;}
.crm-card-stat .k{font-size:11px;color:${C.text3};text-transform:uppercase;letter-spacing:0.04em;}
.crm-card-stat .v{font-size:22px;font-weight:800;color:${C.text};margin-top:4px;}
.kanban{flex:1;display:flex;gap:14px;padding:20px 24px;overflow-x:auto;overflow-y:hidden;}
.kanban-col{flex:0 0 260px;display:flex;flex-direction:column;background:${C.surface};border:1px solid ${C.border};border-radius:12px;max-height:100%;}
.kanban-col.dragover{border-color:${C.blue};background:rgba(77,150,255,0.06);}
.kanban-col-hd{padding:10px 14px;font-size:12px;font-weight:800;color:${C.text2};text-transform:uppercase;letter-spacing:0.03em;border-bottom:1px solid ${C.border};display:flex;justify-content:space-between;}
.kanban-col-body{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;}
.lead-card{background:${C.surface2};border:1px solid ${C.border2};border-radius:10px;padding:10px 12px;cursor:grab;font-size:12px;}
.lead-card:hover{border-color:${C.blue};}
.lead-card .nombre{font-weight:700;color:${C.text};font-size:13px;}
.lead-card .row{color:${C.text3};margin-top:3px;}
.empty-col{text-align:center;color:${C.text3};font-size:11px;padding:20px 8px;}
.modal-bg{position:fixed;inset:0;background:var(--bg-overlay);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:24px;width:min(480px,100vw);max-height:85vh;overflow-y:auto;}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(420px,100vw);background:${C.surface};border-left:1px solid ${C.border};z-index:310;overflow-y:auto;padding:24px;}
.modal-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
.modal-title{font-size:16px;font-weight:700;color:${C.text};}
.sheet-close{background:${C.surface3};border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${C.text2};flex-shrink:0;}
.form-field{margin-bottom:14px;}
.form-label{display:block;font-size:12px;font-weight:600;color:${C.text2};margin-bottom:5px;}
.form-input,.form-select,.form-textarea{width:100%;background:${C.surface2};border:1px solid ${C.border};border-radius:8px;padding:9px 12px;font-size:13px;color:${C.text};outline:none;font-family:inherit;}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.modal-actions{display:flex;gap:8px;margin-top:20px;}
.modal-cancel{flex:1;padding:10px;border-radius:8px;border:1px solid ${C.border2};background:transparent;color:${C.text2};cursor:pointer;font-size:13px;}
.modal-confirm{flex:1;padding:10px;border-radius:8px;border:none;font-size:13px;font-weight:700;cursor:pointer;background:rgba(77,150,255,0.2);color:${C.blue};}
.modal-confirm:disabled{opacity:0.5;cursor:default;}
.interaccion-row{background:${C.surface2};border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:12px;}
.interaccion-row .tipo{font-weight:700;color:${C.text};}
.interaccion-row .fecha{color:${C.text3};font-size:11px;}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${C.surface};border:1px solid ${C.border2};border-radius:24px;padding:10px 20px;font-size:13px;color:${C.text};z-index:400;box-shadow:0 8px 32px rgba(0,0,0,0.4);}
`

interface FormLead {
  nombre_contacto: string; nombre_empresa: string; telefono: string; email: string
  origen: string; valor_estimado: string; proxima_accion: string; proxima_accion_fecha: string; notas: string
}

const FORM_EMPTY: FormLead = {
  nombre_contacto: '', nombre_empresa: '', telefono: '', email: '',
  origen: 'web', valor_estimado: '', proxima_accion: '', proxima_accion_fecha: '', notas: '',
}

function NuevoLeadModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (f: FormLead) => Promise<void> }) {
  const [form, setForm] = useState<FormLead>(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof FormLead, v: string) => setForm(f => ({ ...f, [k]: v }))

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
          <span className="modal-title">+ Nuevo lead</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Nombre de contacto</label>
              <input className="form-input" required value={form.nombre_contacto} onChange={e => set('nombre_contacto', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Empresa</label>
              <input className="form-input" value={form.nombre_empresa} onChange={e => set('nombre_empresa', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Teléfono</label>
              <input className="form-input" value={form.telefono} onChange={e => set('telefono', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Origen</label>
              <select className="form-select" value={form.origen} onChange={e => set('origen', e.target.value)}>
                <option value="referido">Referido</option>
                <option value="redes_sociales">Redes sociales</option>
                <option value="web">Web</option>
                <option value="llamada_fria">Llamada fría</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Valor estimado (S//mes)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.valor_estimado} onChange={e => set('valor_estimado', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Próxima acción</label>
              <input className="form-input" value={form.proxima_accion} onChange={e => set('proxima_accion', e.target.value)} placeholder="Llamar para agendar demo" />
            </div>
            <div className="form-field">
              <label className="form-label">Fecha</label>
              <input className="form-input" type="date" value={form.proxima_accion_fecha} onChange={e => set('proxima_accion_fecha', e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" rows={3} value={form.notas} onChange={e => set('notas', e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="modal-confirm" disabled={saving}>{saving ? 'Creando...' : 'Crear lead'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LeadDrawer({ lead, onClose, onRegistrada }: { lead: Lead; onClose: () => void; onRegistrada: () => void }) {
  const [interacciones, setInteracciones] = useState<Interaccion[] | null>(null)
  const [tipo, setTipo] = useState<Interaccion['tipo']>('nota')
  const [descripcion, setDescripcion] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = () => {
    api.get(`/api/v1/plataforma/crm/leads/${lead.id}/interacciones`)
      .then(r => setInteracciones(r.data?.data ?? []))
      .catch(() => setInteracciones([]))
  }

  useEffect(() => { cargar() }, [lead.id])

  const registrar = async () => {
    if (!descripcion.trim()) return
    setSaving(true)
    try {
      await api.post(`/api/v1/plataforma/crm/leads/${lead.id}/interacciones`, { tipo, descripcion })
      setDescripcion('')
      cargar()
      onRegistrada()
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span className="modal-title">{lead.nombre_empresa ?? lead.nombre_contacto}</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-field">
          <div style={{ fontSize: 12, color: C.text2 }}>👤 {lead.nombre_contacto}</div>
          {lead.telefono && <div style={{ fontSize: 12, color: C.text2 }}>📱 {lead.telefono}</div>}
          {lead.email && <div style={{ fontSize: 12, color: C.text2 }}>✉️ {lead.email}</div>}
          {lead.valor_estimado != null && <div style={{ fontSize: 12, color: C.gold }}>💰 S/ {Number(lead.valor_estimado).toFixed(2)}/mes estimado</div>}
          {lead.proxima_accion && (
            <div style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>
              📅 {lead.proxima_accion}{lead.proxima_accion_fecha ? ` — ${new Date(lead.proxima_accion_fecha).toLocaleDateString('es-PE')}` : ''}
            </div>
          )}
          {lead.notas && <div style={{ fontSize: 12, color: C.text3, marginTop: 8 }}>{lead.notas}</div>}
        </div>

        <div className="form-field" style={{ marginTop: 16 }}>
          <label className="form-label">Registrar interacción</label>
          <div className="form-row">
            <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value as Interaccion['tipo'])}>
              <option value="llamada">Llamada</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="reunion">Reunión</option>
              <option value="nota">Nota</option>
            </select>
            <button className="modal-confirm" disabled={saving || !descripcion.trim()} onClick={() => void registrar()}>
              {saving ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
          <textarea className="form-textarea" rows={2} style={{ marginTop: 8 }} value={descripcion}
            onChange={e => setDescripcion(e.target.value)} placeholder="Describe la interacción..." />
        </div>

        <div className="form-label" style={{ marginTop: 16 }}>Historial</div>
        {interacciones === null && <div style={{ fontSize: 12, color: C.text3 }}>Cargando...</div>}
        {interacciones?.length === 0 && <div style={{ fontSize: 12, color: C.text3 }}>Sin interacciones registradas</div>}
        {interacciones?.map(i => (
          <div key={i.id} className="interaccion-row">
            <span className="tipo">{TIPO_ICONO[i.tipo]} {i.tipo}</span>
            <div className="fecha">{new Date(i.created_at).toLocaleString('es-PE')}</div>
            <div style={{ marginTop: 4, color: C.text2 }}>{i.descripcion}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PlataformaCrmPage() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [leadDetalle, setLeadDetalle] = useState<Lead | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Estado | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<{ total_leads: number; tasa_conversion: number; leads_esta_semana: number } | null>(null)

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2600) }

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const [rLeads, rDash] = await Promise.all([
        api.get('/api/v1/plataforma/crm/leads'),
        api.get('/api/v1/plataforma/crm/dashboard'),
      ])
      setLeads(rLeads.data?.data ?? [])
      setDashboard(rDash.data)
    } catch { setError('Error al cargar leads') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const crearLead = async (f: FormLead) => {
    await api.post('/api/v1/plataforma/crm/leads', {
      nombre_contacto: f.nombre_contacto,
      nombre_empresa: f.nombre_empresa || undefined,
      telefono: f.telefono || undefined,
      email: f.email || undefined,
      origen: f.origen || undefined,
      valor_estimado: f.valor_estimado ? Number(f.valor_estimado) : undefined,
      proxima_accion: f.proxima_accion || undefined,
      proxima_accion_fecha: f.proxima_accion_fecha || undefined,
      notas: f.notas || undefined,
    })
    showToast('Lead creado')
    await cargar()
  }

  const moverLead = async (lead: Lead, nuevoEstado: Estado) => {
    if (lead.estado === nuevoEstado) return
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, estado: nuevoEstado } : l))
    try {
      await api.patch(`/api/v1/plataforma/crm/leads/${lead.id}/estado`, { estado: nuevoEstado })
    } catch {
      showToast('No se pudo mover el lead')
      await cargar()
      return
    }

    if (nuevoEstado === 'convertido') {
      sessionStorage.setItem('crm_lead_convertir', JSON.stringify({
        id: lead.id, nombre_empresa: lead.nombre_empresa, nombre_contacto: lead.nombre_contacto,
        email: lead.email, telefono: lead.telefono,
      }))
      showToast('Lead convertido — abriendo formulario de nueva empresa...')
      setTimeout(() => navigate('/plataforma/empresas'), 900)
    }
  }

  return (
    <div className="crm-root">
      <style>{css}</style>
      <div className="crm-hd">
        <button className="crm-back" onClick={() => navigate('/plataforma/empresas')}>← Empresas</button>
        <span className="crm-title">📇 CRM de Plataforma — Leads</span>
        <button className="crm-btn" onClick={() => setShowNuevo(true)}>+ Nuevo lead</button>
      </div>

      {dashboard && (
        <div className="crm-cards">
          <div className="crm-card-stat"><div className="k">Total leads</div><div className="v">{dashboard.total_leads}</div></div>
          <div className="crm-card-stat"><div className="k">Tasa de conversión</div><div className="v" style={{ color: C.green }}>{dashboard.tasa_conversion}%</div></div>
          <div className="crm-card-stat"><div className="k">Nuevos esta semana</div><div className="v" style={{ color: C.blue }}>{dashboard.leads_esta_semana}</div></div>
        </div>
      )}

      {cargando && <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>Cargando leads...</div>}
      {error && <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>{error}</div>}

      {!cargando && !error && (
        <div className="kanban">
          {COLUMNAS.map(col => {
            const leadsCol = leads.filter(l => l.estado === col.estado)
            return (
              <div
                key={col.estado}
                className={`kanban-col${dragOverCol === col.estado ? ' dragover' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOverCol(col.estado) }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOverCol(null)
                  const leadId = e.dataTransfer.getData('text/lead-id')
                  const lead = leads.find(l => l.id === leadId)
                  if (lead) void moverLead(lead, col.estado)
                }}
              >
                <div className="kanban-col-hd"><span>{col.label}</span><span>{leadsCol.length}</span></div>
                <div className="kanban-col-body">
                  {leadsCol.length === 0 && <div className="empty-col">Sin leads</div>}
                  {leadsCol.map(lead => (
                    <div
                      key={lead.id}
                      className="lead-card"
                      draggable
                      onDragStart={e => e.dataTransfer.setData('text/lead-id', lead.id)}
                      onClick={() => setLeadDetalle(lead)}
                    >
                      <div className="nombre">{lead.nombre_empresa ?? lead.nombre_contacto}</div>
                      <div className="row">👤 {lead.nombre_contacto}</div>
                      {lead.telefono && <div className="row">📱 {lead.telefono}</div>}
                      {lead.valor_estimado != null && (
                        <div className="row" style={{ color: C.gold }}>💰 S/ {Number(lead.valor_estimado).toFixed(0)}/mes</div>
                      )}
                      {lead.proxima_accion && (
                        <div className="row">📅 {lead.proxima_accion}{lead.proxima_accion_fecha ? ` — ${new Date(lead.proxima_accion_fecha).toLocaleDateString('es-PE')}` : ''}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNuevo && <NuevoLeadModal onClose={() => setShowNuevo(false)} onSubmit={crearLead} />}
      {leadDetalle && (
        <LeadDrawer lead={leadDetalle} onClose={() => setLeadDetalle(null)} onRegistrada={() => showToast('Interacción registrada')} />
      )}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
