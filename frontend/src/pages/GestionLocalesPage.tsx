import { useState, useEffect, type FormEvent } from 'react'
import api from '../api/client'
import { useRol } from '../hooks/useRol'

const C = {
  bg: '#070A10', surface: '#0D1017', surface2: '#12171F', surface3: '#1B2131',
  border: 'rgba(255,255,255,0.06)', border2: 'rgba(255,255,255,0.1)',
  text: '#F0F4F8', text2: '#8A9AB5', text3: '#556070',
  green: '#22C55E', blue: '#4D96FF', yellow: '#EAB308', red: '#EF4444',
  gold: '#D4A853',
}

type Estado = 'activo' | 'pausado' | 'remodelacion' | 'inactivo'

interface Local {
  id: string; codigo: string; nombre: string; ruc?: string; razon_social?: string
  direccion?: string; ciudad?: string; pais?: string; telefono?: string; email?: string
  color_tema?: string; estado: Estado; razon_pausa?: string; activo: boolean
  created_at: string; updated_at: string
  total_habitaciones: number; total_personal: number
}

const ESTADO_INFO: Record<Estado, { icon: string; label: string; color: string }> = {
  activo: { icon: '🟢', label: 'Activo', color: C.green },
  pausado: { icon: '🟠', label: 'Pausado', color: C.yellow },
  remodelacion: { icon: '🔵', label: 'Remodelación', color: C.blue },
  inactivo: { icon: '⚫', label: 'Inactivo', color: C.text3 },
}

const css = `
.loc-root{height:100%;background:${C.bg};color:${C.text};font-family:-apple-system,BlinkMacSystemFont,sans-serif;overflow-y:auto;}
.loc-root *{box-sizing:border-box;}
.loc-hd{display:flex;align-items:center;gap:12px;padding:18px 24px;border-bottom:1px solid ${C.border};background:${C.surface};position:sticky;top:0;z-index:5;}
.loc-title{font-size:18px;font-weight:800;color:${C.text};flex:1;}
.loc-add{display:flex;align-items:center;gap:7px;padding:9px 16px;background:rgba(77,150,255,0.12);border:1px solid rgba(77,150,255,0.25);border-radius:8px;color:${C.blue};font-size:13px;font-weight:700;cursor:pointer;}
.loc-add:hover{background:rgba(77,150,255,0.18);}
.loc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;padding:24px;}
.loc-card{background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:12px;}
.loc-card-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;}
.loc-name{font-size:15px;font-weight:800;color:${C.text};}
.loc-code{font-size:11px;color:${C.text3};font-family:monospace;margin-top:2px;}
.loc-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700;background:${C.surface2};white-space:nowrap;}
.loc-meta{display:flex;flex-direction:column;gap:4px;font-size:12px;color:${C.text2};}
.loc-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.loc-stat{background:${C.surface2};border-radius:8px;padding:9px 11px;}
.loc-stat .k{font-size:10px;color:${C.text3};text-transform:uppercase;letter-spacing:0.04em;}
.loc-stat .v{font-size:16px;font-weight:800;color:${C.text};}
.loc-actions{display:flex;gap:8px;margin-top:4px;}
.loc-act-btn{flex:1;padding:8px;border-radius:8px;border:1px solid ${C.border2};background:transparent;color:${C.text2};font-size:12px;font-weight:600;cursor:pointer;}
.loc-act-btn:hover{color:${C.text};border-color:${C.border2};}
.loc-pausa-note{font-size:11px;color:${C.yellow};background:rgba(234,179,8,0.08);border-radius:6px;padding:6px 8px;}
.empty{text-align:center;color:${C.text3};font-size:14px;padding:48px;grid-column:1/-1;}
.spinner-center{text-align:center;color:${C.text3};font-size:14px;padding:48px;}
.error-center{text-align:center;color:${C.text3};font-size:14px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;}
.retry-btn{padding:8px 16px;background:${C.surface2};border:1px solid ${C.border2};border-radius:8px;color:${C.text};cursor:pointer;font-size:13px;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:24px;width:min(440px,100vw);max-height:85vh;overflow-y:auto;}
.modal-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
.modal-title{font-size:16px;font-weight:700;color:${C.text};}
.sheet-close{background:${C.surface3};border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${C.text2};flex-shrink:0;}
.form-field{margin-bottom:14px;}
.form-label{display:block;font-size:12px;font-weight:600;color:${C.text2};margin-bottom:5px;}
.form-input,.form-select,.form-textarea{width:100%;background:${C.surface2};border:1px solid ${C.border};border-radius:8px;padding:9px 12px;font-size:13px;color:${C.text};outline:none;font-family:inherit;}
.form-input:focus,.form-select:focus,.form-textarea:focus{border-color:${C.border2};}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.color-row{display:flex;align-items:center;gap:10px;}
.color-swatch{width:36px;height:36px;border-radius:8px;border:1px solid ${C.border2};flex-shrink:0;}
.modal-actions{display:flex;gap:8px;margin-top:20px;}
.modal-cancel{flex:1;padding:10px;border-radius:8px;border:1px solid ${C.border2};background:transparent;color:${C.text2};cursor:pointer;font-size:13px;}
.modal-confirm{flex:1;padding:10px;border-radius:8px;border:none;font-size:13px;font-weight:700;cursor:pointer;background:rgba(77,150,255,0.2);color:${C.blue};}
.modal-confirm:disabled{opacity:0.5;cursor:default;}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${C.surface};border:1px solid ${C.border2};border-radius:24px;padding:10px 20px;font-size:13px;color:${C.text};z-index:400;display:flex;align-items:center;gap:8px;box-shadow:0 8px 32px rgba(0,0,0,0.4);}
`

interface FormLocal {
  nombre: string; codigo: string; ruc: string; razon_social: string
  direccion: string; ciudad: string; color_tema: string; telefono: string; email: string
}

const FORM_EMPTY: FormLocal = { nombre: '', codigo: '', ruc: '', razon_social: '', direccion: '', ciudad: '', color_tema: '#4D96FF', telefono: '', email: '' }

function LocalFormModal({ initial, isEdit, onClose, onSubmit }: {
  initial: FormLocal; isEdit: boolean; onClose: () => void; onSubmit: (f: FormLocal) => Promise<void>
}) {
  const [form, setForm] = useState<FormLocal>(initial)
  const [saving, setSaving] = useState(false)

  const set = (k: keyof FormLocal, v: string) => setForm(f => ({ ...f, [k]: v }))

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
          <span className="modal-title">{isEdit ? '✏️ Editar local' : '+ Agregar local'}</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Nombre</label>
              <input className="form-input" required value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Hotel Miraflores" />
            </div>
            <div className="form-field">
              <label className="form-label">Código</label>
              <input className="form-input" required disabled={isEdit} value={form.codigo} onChange={e => set('codigo', e.target.value)} placeholder="MIRA01" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">RUC</label>
              <input className="form-input" value={form.ruc} onChange={e => set('ruc', e.target.value)} placeholder="20123456789" />
            </div>
            <div className="form-field">
              <label className="form-label">Ciudad</label>
              <input className="form-input" value={form.ciudad} onChange={e => set('ciudad', e.target.value)} placeholder="Lima" />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Razón social</label>
            <input className="form-input" value={form.razon_social} onChange={e => set('razon_social', e.target.value)} placeholder="HOTELES PARAÍSO S.A.C." />
          </div>
          <div className="form-field">
            <label className="form-label">Dirección</label>
            <input className="form-input" value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Av. Principal 123" />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Teléfono</label>
              <input className="form-input" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+51 1 234 5678" />
            </div>
            <div className="form-field">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contacto@hotel.com" />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Color del tema</label>
            <div className="color-row">
              <div className="color-swatch" style={{ background: form.color_tema }} />
              <input className="form-input" type="color" style={{ padding: 4, height: 40 }} value={form.color_tema} onChange={e => set('color_tema', e.target.value)} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="modal-confirm" disabled={saving}>{saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear local'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EstadoModal({ local, onClose, onSubmit }: {
  local: Local; onClose: () => void; onSubmit: (estado: Estado, razon: string) => Promise<void>
}) {
  const [estado, setEstado] = useState<Estado>(local.estado)
  const [razon, setRazon] = useState(local.razon_pausa ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try { await onSubmit(estado, razon); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span className="modal-title">Cambiar estado · {local.nombre}</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-field">
            <label className="form-label">Nuevo estado</label>
            <select className="form-select" value={estado} onChange={e => setEstado(e.target.value as Estado)}>
              {(Object.keys(ESTADO_INFO) as Estado[]).map(e => (
                <option key={e} value={e}>{ESTADO_INFO[e].icon} {ESTADO_INFO[e].label}</option>
              ))}
            </select>
          </div>
          {estado !== 'activo' && (
            <div className="form-field">
              <label className="form-label">Motivo (opcional)</label>
              <textarea className="form-textarea" rows={3} value={razon} onChange={e => setRazon(e.target.value)} placeholder="Explica el motivo del cambio de estado..." />
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="modal-confirm" disabled={saving}>{saving ? 'Guardando...' : 'Actualizar estado'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function GestionLocalesPage() {
  const { tienePermiso } = useRol()
  const puedeGestionar = tienePermiso('locales.gestionar')

  const [locales, setLocales] = useState<Local[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editLocal, setEditLocal] = useState<Local | null>(null)
  const [estadoLocal, setEstadoLocal] = useState<Local | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2600) }

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const r = await api.get('/api/v1/locales?todos=true')
      setLocales(r.data?.data ?? r.data ?? [])
    } catch { setError('Error al cargar locales') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const crear = async (f: FormLocal) => {
    await api.post('/api/v1/locales', {
      codigo: f.codigo, nombre: f.nombre, ruc: f.ruc || undefined, razon_social: f.razon_social || undefined,
      direccion: f.direccion || undefined, ciudad: f.ciudad || undefined, color_tema: f.color_tema || undefined,
      telefono: f.telefono || undefined, email: f.email || undefined,
    })
    showToast('Local creado correctamente')
    await cargar()
  }

  const editar = async (id: string, f: FormLocal) => {
    await api.put(`/api/v1/locales/${id}`, {
      nombre: f.nombre, ruc: f.ruc || undefined, razon_social: f.razon_social || undefined,
      direccion: f.direccion || undefined, ciudad: f.ciudad || undefined, color_tema: f.color_tema || undefined,
      telefono: f.telefono || undefined, email: f.email || undefined,
    })
    showToast('Local actualizado')
    await cargar()
  }

  const cambiarEstado = async (id: string, estado: Estado, razon_pausa: string) => {
    await api.patch(`/api/v1/locales/${id}/estado`, { estado, razon_pausa: razon_pausa || undefined })
    showToast('Estado actualizado')
    await cargar()
  }

  return (
    <div className="loc-root">
      <style>{css}</style>
      <div className="loc-hd">
        <span className="loc-title">🏨 Gestión de locales</span>
        {puedeGestionar && (
          <button className="loc-add" onClick={() => setShowAdd(true)}>+ Agregar local</button>
        )}
      </div>

      {cargando && <div className="spinner-center">Cargando locales...</div>}
      {error && <div className="error-center"><span>{error}</span><button className="retry-btn" onClick={cargar}>Reintentar</button></div>}

      {!cargando && !error && (
        <div className="loc-grid">
          {locales.length === 0 && <div className="empty">Sin locales registrados</div>}
          {locales.map(l => {
            const info = ESTADO_INFO[l.estado] ?? ESTADO_INFO.activo
            return (
              <div key={l.id} className="loc-card">
                <div className="loc-card-hd">
                  <div>
                    <div className="loc-name">{l.nombre}</div>
                    <div className="loc-code">{l.codigo} · {l.ciudad || '—'}</div>
                  </div>
                  <span className="loc-badge" style={{ color: info.color }}>{info.icon} {info.label}</span>
                </div>
                <div className="loc-meta">
                  <span>RUC: {l.ruc || '—'}</span>
                  {l.direccion && <span>{l.direccion}</span>}
                </div>
                {l.estado !== 'activo' && l.razon_pausa && (
                  <div className="loc-pausa-note">⚠ {l.razon_pausa}</div>
                )}
                <div className="loc-stats">
                  <div className="loc-stat"><div className="k">Habitaciones</div><div className="v">{l.total_habitaciones}</div></div>
                  <div className="loc-stat"><div className="k">Personal</div><div className="v">{l.total_personal}</div></div>
                </div>
                {puedeGestionar && (
                  <div className="loc-actions">
                    <button className="loc-act-btn" onClick={() => setEditLocal(l)}>✏️ Editar</button>
                    <button className="loc-act-btn" onClick={() => setEstadoLocal(l)}>🔄 Estado</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <LocalFormModal initial={FORM_EMPTY} isEdit={false} onClose={() => setShowAdd(false)} onSubmit={crear} />
      )}
      {editLocal && (
        <LocalFormModal
          initial={{
            nombre: editLocal.nombre, codigo: editLocal.codigo, ruc: editLocal.ruc ?? '', razon_social: editLocal.razon_social ?? '',
            direccion: editLocal.direccion ?? '', ciudad: editLocal.ciudad ?? '', color_tema: editLocal.color_tema ?? '#4D96FF',
            telefono: editLocal.telefono ?? '', email: editLocal.email ?? '',
          }}
          isEdit
          onClose={() => setEditLocal(null)}
          onSubmit={f => editar(editLocal.id, f)}
        />
      )}
      {estadoLocal && (
        <EstadoModal local={estadoLocal} onClose={() => setEstadoLocal(null)} onSubmit={(estado, razon) => cambiarEstado(estadoLocal.id, estado, razon)} />
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
