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

interface Rol { id: string; codigo: string; nombre: string; descripcion?: string; alcance_global: boolean; permisos: string[] }
interface LocalOpt { id: string; nombre: string }
interface UsuarioLocal { local_id: string; es_local_principal: boolean; puede_operar: boolean; local: { nombre: string }; rol: { codigo: string; nombre: string } }
interface Personal {
  id: string; nombre: string; apellido: string; email: string; activo: boolean
  rol_nuevo: { codigo: string; nombre: string } | null
  usuario_locales: UsuarioLocal[]
}

const css = `
.per-root{height:100%;background:${C.bg};color:${C.text};font-family:-apple-system,BlinkMacSystemFont,sans-serif;overflow-y:auto;}
.per-root *{box-sizing:border-box;}
.per-hd{display:flex;align-items:center;gap:12px;padding:18px 24px;border-bottom:1px solid ${C.border};background:${C.surface};position:sticky;top:0;z-index:5;}
.per-title{font-size:18px;font-weight:800;color:${C.text};flex:1;}
.per-add{display:flex;align-items:center;gap:7px;padding:9px 16px;background:rgba(77,150,255,0.12);border:1px solid rgba(77,150,255,0.25);border-radius:8px;color:${C.blue};font-size:13px;font-weight:700;cursor:pointer;}
.per-add:hover{background:rgba(77,150,255,0.18);}
.per-body{padding:24px;}
.tbl{width:100%;border-collapse:collapse;background:${C.surface};border:1px solid ${C.border};border-radius:12px;overflow:hidden;}
.tbl thead tr{background:${C.surface2};}
.tbl th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:${C.text3};text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid ${C.border};}
.tbl td{padding:12px 14px;border-bottom:1px solid ${C.border};font-size:13px;color:${C.text};vertical-align:top;}
.tbl tr:last-child td{border-bottom:none;}
.rol-chip{display:inline-flex;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;background:rgba(212,168,83,0.12);color:${C.gold};}
.local-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:11px;background:${C.surface2};color:${C.text2};margin:2px 4px 2px 0;}
.local-chip .rn{color:${C.blue};font-weight:600;}
.estado-tag{font-size:12px;font-weight:600;}
.act-btn{background:${C.surface2};border:1px solid ${C.border};border-radius:6px;padding:5px 10px;font-size:11px;color:${C.text2};cursor:pointer;}
.act-btn:hover{border-color:${C.border2};color:${C.text};}
.empty{text-align:center;color:${C.text3};font-size:14px;padding:48px;}
.spinner-center{text-align:center;color:${C.text3};font-size:14px;padding:48px;}
.error-center{text-align:center;color:${C.text3};font-size:14px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;}
.retry-btn{padding:8px 16px;background:${C.surface2};border:1px solid ${C.border2};border-radius:8px;color:${C.text};cursor:pointer;font-size:13px;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:24px;width:min(460px,100vw);max-height:85vh;overflow-y:auto;}
.modal-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
.modal-title{font-size:16px;font-weight:700;color:${C.text};}
.sheet-close{background:${C.surface3};border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${C.text2};flex-shrink:0;}
.form-field{margin-bottom:14px;}
.form-label{display:block;font-size:12px;font-weight:600;color:${C.text2};margin-bottom:5px;}
.form-hint{font-size:11px;color:${C.text3};margin-top:4px;}
.form-input,.form-select{width:100%;background:${C.surface2};border:1px solid ${C.border};border-radius:8px;padding:9px 12px;font-size:13px;color:${C.text};outline:none;}
.form-input:focus,.form-select:focus{border-color:${C.border2};}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.toggle-inline{display:flex;align-items:center;gap:8px;font-size:13px;color:${C.text2};}
.modal-actions{display:flex;gap:8px;margin-top:20px;}
.modal-cancel{flex:1;padding:10px;border-radius:8px;border:1px solid ${C.border2};background:transparent;color:${C.text2};cursor:pointer;font-size:13px;}
.modal-confirm{flex:1;padding:10px;border-radius:8px;border:none;font-size:13px;font-weight:700;cursor:pointer;background:rgba(77,150,255,0.2);color:${C.blue};}
.modal-confirm:disabled{opacity:0.5;cursor:default;}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${C.surface};border:1px solid ${C.border2};border-radius:24px;padding:10px 20px;font-size:13px;color:${C.text};z-index:400;display:flex;align-items:center;gap:8px;box-shadow:0 8px 32px rgba(0,0,0,0.4);}
.err-msg{padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:14px;background:rgba(239,68,68,0.1);color:${C.red};}
`

interface NewUserForm { nombre: string; apellido: string; email: string; password: string; local_id: string; rol_codigo: string }
const NEW_USER_EMPTY: NewUserForm = { nombre: '', apellido: '', email: '', password: '', local_id: '', rol_codigo: '' }

function NuevoUsuarioModal({ locales, roles, onClose, onSubmit }: {
  locales: LocalOpt[]; roles: Rol[]; onClose: () => void; onSubmit: (f: NewUserForm) => Promise<void>
}) {
  const [form, setForm] = useState<NewUserForm>(NEW_USER_EMPTY)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: keyof NewUserForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (form.password.length < 8) { setErr('La contraseña debe tener al menos 8 caracteres'); return }
    if (!form.local_id || !form.rol_codigo) { setErr('Selecciona un local y un rol'); return }
    setSaving(true)
    try { await onSubmit(form); onClose() }
    catch { setErr('Error al crear el usuario') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span className="modal-title">+ Nuevo usuario</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        {err && <div className="err-msg">{err}</div>}
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Nombre</label>
              <input className="form-input" required value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="María" />
            </div>
            <div className="form-field">
              <label className="form-label">Apellido</label>
              <input className="form-input" required value={form.apellido} onChange={e => set('apellido', e.target.value)} placeholder="López" />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="maria@hotel.com" />
          </div>
          <div className="form-field">
            <label className="form-label">Contraseña temporal</label>
            <input className="form-input" type="password" required value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Local</label>
              <select className="form-select" required value={form.local_id} onChange={e => set('local_id', e.target.value)}>
                <option value="">Seleccionar...</option>
                {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Rol</label>
              <select className="form-select" required value={form.rol_codigo} onChange={e => set('rol_codigo', e.target.value)}>
                <option value="">Seleccionar...</option>
                {roles.map(r => <option key={r.id} value={r.codigo}>{r.nombre}</option>)}
              </select>
            </div>
          </div>
          {form.rol_codigo && (
            <div className="form-hint">{roles.find(r => r.codigo === form.rol_codigo)?.descripcion}</div>
          )}
          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="modal-confirm" disabled={saving}>{saving ? 'Creando...' : 'Crear usuario'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface AccesoForm { local_id: string; rol_codigo: string; puede_operar: boolean }

function EditarAccesosModal({ persona, locales, roles, onClose, onSubmit }: {
  persona: Personal; locales: LocalOpt[]; roles: Rol[]; onClose: () => void; onSubmit: (f: AccesoForm) => Promise<void>
}) {
  const [form, setForm] = useState<AccesoForm>({
    local_id: persona.usuario_locales[0]?.local_id ?? '',
    rol_codigo: persona.usuario_locales[0]?.rol.codigo ?? '',
    puede_operar: persona.usuario_locales[0]?.puede_operar ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!form.local_id || !form.rol_codigo) { setErr('Selecciona un local y un rol'); return }
    setSaving(true)
    try { await onSubmit(form); onClose() }
    catch { setErr('Error al actualizar accesos') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span className="modal-title">Editar accesos · {persona.nombre} {persona.apellido}</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        {err && <div className="err-msg">{err}</div>}
        <form onSubmit={submit}>
          <div className="form-field">
            <label className="form-label">Local</label>
            <select className="form-select" required value={form.local_id} onChange={e => setForm(f => ({ ...f, local_id: e.target.value }))}>
              <option value="">Seleccionar...</option>
              {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Rol en ese local</label>
            <select className="form-select" required value={form.rol_codigo} onChange={e => setForm(f => ({ ...f, rol_codigo: e.target.value }))}>
              <option value="">Seleccionar...</option>
              {roles.map(r => <option key={r.id} value={r.codigo}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="toggle-inline">
              <input type="checkbox" checked={form.puede_operar} onChange={e => setForm(f => ({ ...f, puede_operar: e.target.checked }))} />
              Puede operar en este local
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="modal-confirm" disabled={saving}>{saving ? 'Guardando...' : 'Guardar acceso'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function GestionPersonalPage() {
  const { tienePermiso } = useRol()
  const puedeGestionar = tienePermiso('personal.gestionar')

  const [personal, setPersonal] = useState<Personal[]>([])
  const [locales, setLocales] = useState<LocalOpt[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [editAccesos, setEditAccesos] = useState<Personal | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2600) }

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const [rP, rL, rR] = await Promise.all([
        api.get('/api/v1/personal'),
        api.get('/api/v1/locales?todos=true'),
        api.get('/api/v1/roles'),
      ])
      setPersonal(rP.data?.data ?? rP.data ?? [])
      setLocales((rL.data?.data ?? rL.data ?? []).map((l: { id: string; nombre: string }) => ({ id: l.id, nombre: l.nombre })))
      setRoles(rR.data?.data ?? rR.data ?? [])
    } catch { setError('Error al cargar personal') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const crearUsuario = async (f: NewUserForm) => {
    await api.post('/api/v1/personal', f)
    showToast('Usuario creado correctamente')
    await cargar()
  }

  const guardarAccesos = async (personaId: string, f: AccesoForm) => {
    await api.put(`/api/v1/personal/${personaId}/accesos`, { locales: [f] })
    showToast('Accesos actualizados')
    await cargar()
  }

  return (
    <div className="per-root">
      <style>{css}</style>
      <div className="per-hd">
        <span className="per-title">👥 Gestión de personal</span>
        {puedeGestionar && <button className="per-add" onClick={() => setShowNuevo(true)}>+ Nuevo usuario</button>}
      </div>

      <div className="per-body">
        {cargando && <div className="spinner-center">Cargando personal...</div>}
        {error && <div className="error-center"><span>{error}</span><button className="retry-btn" onClick={cargar}>Reintentar</button></div>}

        {!cargando && !error && (
          <table className="tbl">
            <thead>
              <tr>
                <th>Nombre</th><th>Email</th><th>Rol</th><th>Locales</th><th>Estado</th>{puedeGestionar && <th></th>}
              </tr>
            </thead>
            <tbody>
              {personal.length === 0 && (
                <tr><td colSpan={puedeGestionar ? 6 : 5} className="empty">Sin usuarios registrados</td></tr>
              )}
              {personal.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.nombre} {p.apellido}</td>
                  <td style={{ color: C.text3 }}>{p.email}</td>
                  <td>{p.rol_nuevo && <span className="rol-chip">{p.rol_nuevo.nombre}</span>}</td>
                  <td>
                    {p.usuario_locales.length === 0 && <span style={{ color: C.text3 }}>—</span>}
                    {p.usuario_locales.map(ul => (
                      <span key={ul.local_id} className="local-chip">
                        {ul.local.nombre} · <span className="rn">{ul.rol.nombre}</span>{ul.es_local_principal ? ' ★' : ''}
                      </span>
                    ))}
                  </td>
                  <td><span className="estado-tag" style={{ color: p.activo ? C.green : C.text3 }}>{p.activo ? '● Activo' : '○ Inactivo'}</span></td>
                  {puedeGestionar && (
                    <td><button className="act-btn" onClick={() => setEditAccesos(p)}>Editar accesos</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNuevo && (
        <NuevoUsuarioModal locales={locales} roles={roles} onClose={() => setShowNuevo(false)} onSubmit={crearUsuario} />
      )}
      {editAccesos && (
        <EditarAccesosModal
          persona={editAccesos} locales={locales} roles={roles}
          onClose={() => setEditAccesos(null)}
          onSubmit={f => guardarAccesos(editAccesos.id, f)}
        />
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
