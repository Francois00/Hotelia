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

type Tab = 'ventas' | 'diario' | 'ple' | 'exportar'

interface ResumenVentas {
  mes: string
  total_ingresos: number
  total_reservas: number
  ticket_promedio: number
  por_metodo: Array<{ metodo: string; total: number; cantidad: number }>
  por_tipo: Array<{ tipo: string; total: number; cantidad: number }>
  por_canal: Array<{ canal: string; total: number; cantidad: number }>
}

interface Asiento {
  id: string; fecha: string; numero_asiento: string | null
  tipo: 'ingreso' | 'egreso' | 'ajuste' | 'apertura' | 'cierre'
  cuenta_contable: string | null; concepto: string; debe: number; haber: number; saldo: number
}

interface LibroDiario {
  fecha_inicio: string; fecha_fin: string
  total_debe: number; total_haber: number; saldo_final: number
  asientos: Asiento[]
}

const fmtMoneda = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const mesActual = () => new Date().toISOString().slice(0, 7)
const primerDiaMes = () => new Date().toISOString().slice(0, 8) + '01'
const hoy = () => new Date().toISOString().slice(0, 10)

async function descargarBlob(url: string, filename: string) {
  const r = await api.get(url, { responseType: 'blob' })
  const objectUrl = URL.createObjectURL(r.data as Blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

const css = `
.ctb-root{height:100%;background:${C.bg};color:${C.text};font-family:-apple-system,BlinkMacSystemFont,sans-serif;overflow-y:auto;}
.ctb-root *{box-sizing:border-box;}
.ctb-hd{padding:18px 24px;border-bottom:1px solid ${C.border};background:${C.surface};position:sticky;top:0;z-index:5;}
.ctb-title{font-size:18px;font-weight:800;color:${C.text};margin-bottom:14px;}
.ctb-tabs{display:flex;gap:4px;}
.ctb-tab{padding:9px 16px;border-radius:8px;border:none;background:transparent;color:${C.text2};font-size:13px;font-weight:600;cursor:pointer;}
.ctb-tab.on{background:${C.surface2};color:${C.text};}
.ctb-body{padding:24px;}
.ctb-toolbar{display:flex;align-items:flex-end;gap:12px;margin-bottom:20px;flex-wrap:wrap;}
.ctb-field{display:flex;flex-direction:column;gap:5px;}
.ctb-field label{font-size:11px;color:${C.text3};text-transform:uppercase;letter-spacing:0.04em;}
.ctb-field input,.ctb-field select{background:${C.surface2};border:1px solid ${C.border};border-radius:8px;padding:8px 10px;font-size:13px;color:${C.text};outline:none;}
.ctb-btn{display:flex;align-items:center;gap:6px;padding:9px 14px;border-radius:8px;border:1px solid ${C.border2};background:${C.surface2};color:${C.text};font-size:13px;font-weight:600;cursor:pointer;}
.ctb-btn:hover{border-color:${C.blue};}
.ctb-btn.primary{background:rgba(77,150,255,0.15);border-color:rgba(77,150,255,0.3);color:${C.blue};}
.ctb-btn:disabled{opacity:0.5;cursor:default;}
.ctb-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:22px;}
.ctb-kpi{background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:16px;}
.ctb-kpi .k{font-size:11px;color:${C.text3};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;}
.ctb-kpi .v{font-size:22px;font-weight:800;color:${C.text};}
.ctb-tbl-wrap{background:${C.surface};border:1px solid ${C.border};border-radius:12px;overflow:hidden;}
.ctb-tbl{width:100%;border-collapse:collapse;}
.ctb-tbl thead tr{background:${C.surface2};}
.ctb-tbl th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:${C.text3};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid ${C.border};white-space:nowrap;}
.ctb-tbl td{padding:10px 14px;border-bottom:1px solid ${C.border};font-size:13px;color:${C.text};}
.ctb-tbl tr:last-child td{border-bottom:none;}
.ctb-tbl tfoot td{font-weight:800;background:${C.surface2};}
.ctb-tbl-title{padding:12px 14px;font-size:13px;font-weight:700;color:${C.text2};border-bottom:1px solid ${C.border};}
.ctb-grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:20px;}
.ctb-warn{background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:12px;padding:16px;color:${C.yellow};font-size:13px;line-height:1.5;margin-bottom:20px;}
.ctb-ple-actions{display:flex;gap:12px;flex-wrap:wrap;}
.empty{text-align:center;color:${C.text3};font-size:14px;padding:32px;}
.spinner-center{text-align:center;color:${C.text3};font-size:14px;padding:48px;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:24px;width:min(440px,100vw);}
.modal-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
.modal-title{font-size:16px;font-weight:700;color:${C.text};}
.sheet-close{background:${C.surface3};border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${C.text2};}
.form-field{margin-bottom:14px;}
.form-label{display:block;font-size:12px;font-weight:600;color:${C.text2};margin-bottom:5px;}
.form-input,.form-select,.form-textarea{width:100%;background:${C.surface2};border:1px solid ${C.border};border-radius:8px;padding:9px 12px;font-size:13px;color:${C.text};outline:none;font-family:inherit;}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.modal-actions{display:flex;gap:8px;margin-top:20px;}
.modal-cancel{flex:1;padding:10px;border-radius:8px;border:1px solid ${C.border2};background:transparent;color:${C.text2};cursor:pointer;font-size:13px;}
.modal-confirm{flex:1;padding:10px;border-radius:8px;border:none;font-size:13px;font-weight:700;cursor:pointer;background:rgba(77,150,255,0.2);color:${C.blue};}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${C.surface};border:1px solid ${C.border2};border-radius:24px;padding:10px 20px;font-size:13px;color:${C.text};z-index:400;}
`

function TabResumenVentas() {
  const [mes, setMes] = useState(mesActual())
  const [data, setData] = useState<ResumenVentas | null>(null)
  const [cargando, setCargando] = useState(true)
  const { tienePermiso } = useRol()

  const cargar = async () => {
    setCargando(true)
    try {
      const r = await api.get<ResumenVentas>('/api/v1/contabilidad/resumen-ventas', { params: { mes } })
      setData(r.data)
    } catch { setData(null) }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [mes]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="ctb-toolbar">
        <div className="ctb-field">
          <label>Mes</label>
          <input type="month" value={mes} onChange={e => setMes(e.target.value)} />
        </div>
        {tienePermiso('contabilidad.exportar') && (
          <button className="ctb-btn" onClick={() => descargarBlob(`/api/v1/reportes/mensual/excel?mes=${mes}`, `reporte-${mes}.xlsx`)}>
            📊 Exportar Excel
          </button>
        )}
      </div>

      {cargando && <div className="spinner-center">Cargando...</div>}

      {!cargando && data && (
        <>
          <div className="ctb-kpis">
            <div className="ctb-kpi"><div className="k">Total ingresos</div><div className="v">{fmtMoneda(data.total_ingresos)}</div></div>
            <div className="ctb-kpi"><div className="k">Total reservas</div><div className="v">{data.total_reservas}</div></div>
            <div className="ctb-kpi"><div className="k">Ticket promedio</div><div className="v">{fmtMoneda(data.ticket_promedio)}</div></div>
          </div>

          <div className="ctb-grid-3">
            <div className="ctb-tbl-wrap">
              <div className="ctb-tbl-title">Por método de pago</div>
              <table className="ctb-tbl">
                <thead><tr><th>Método</th><th>Monto</th><th>Cant.</th></tr></thead>
                <tbody>
                  {data.por_metodo.map(r => <tr key={r.metodo}><td>{r.metodo}</td><td>{fmtMoneda(r.total)}</td><td>{r.cantidad}</td></tr>)}
                  {data.por_metodo.length === 0 && <tr><td colSpan={3} className="empty">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="ctb-tbl-wrap">
              <div className="ctb-tbl-title">Por tipo de habitación</div>
              <table className="ctb-tbl">
                <thead><tr><th>Tipo</th><th>Monto</th><th>Cant.</th></tr></thead>
                <tbody>
                  {data.por_tipo.map(r => <tr key={r.tipo}><td>{r.tipo}</td><td>{fmtMoneda(r.total)}</td><td>{r.cantidad}</td></tr>)}
                  {data.por_tipo.length === 0 && <tr><td colSpan={3} className="empty">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="ctb-tbl-wrap">
              <div className="ctb-tbl-title">Por canal</div>
              <table className="ctb-tbl">
                <thead><tr><th>Canal</th><th>Monto</th><th>Cant.</th></tr></thead>
                <tbody>
                  {data.por_canal.map(r => <tr key={r.canal}><td>{r.canal}</td><td>{fmtMoneda(r.total)}</td><td>{r.cantidad}</td></tr>)}
                  {data.por_canal.length === 0 && <tr><td colSpan={3} className="empty">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function NuevoAsientoModal({ onClose, onSubmit }: {
  onClose: () => void
  onSubmit: (f: { fecha: string; tipo: string; concepto: string; debe: number; haber: number; cuenta_contable: string }) => Promise<void>
}) {
  const [form, setForm] = useState({ fecha: hoy(), tipo: 'ajuste', concepto: '', debe: 0, haber: 0, cuenta_contable: '' })
  const [saving, setSaving] = useState(false)

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
          <span className="modal-title">+ Nuevo asiento manual</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Fecha</label>
              <input className="form-input" type="date" required value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div className="form-field">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
                <option value="ajuste">Ajuste</option>
                <option value="apertura">Apertura</option>
                <option value="cierre">Cierre</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Concepto</label>
            <input className="form-input" required value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Debe</label>
              <input className="form-input" type="number" step="0.01" min={0} value={form.debe} onChange={e => setForm(f => ({ ...f, debe: Number(e.target.value) }))} />
            </div>
            <div className="form-field">
              <label className="form-label">Haber</label>
              <input className="form-input" type="number" step="0.01" min={0} value={form.haber} onChange={e => setForm(f => ({ ...f, haber: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Cuenta contable (opcional)</label>
            <input className="form-input" value={form.cuenta_contable} onChange={e => setForm(f => ({ ...f, cuenta_contable: e.target.value }))} />
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="modal-confirm" disabled={saving}>{saving ? 'Guardando...' : 'Crear asiento'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TabLibroDiario() {
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes())
  const [fechaFin, setFechaFin] = useState(hoy())
  const [data, setData] = useState<LibroDiario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [showNuevo, setShowNuevo] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const { tienePermiso } = useRol()

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2600) }

  const cargar = async () => {
    setCargando(true)
    try {
      const r = await api.get<LibroDiario>('/api/v1/contabilidad/libro-diario', { params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin } })
      setData(r.data)
    } catch { setData(null) }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const crearAsiento = async (f: { fecha: string; tipo: string; concepto: string; debe: number; haber: number; cuenta_contable: string }) => {
    await api.post('/api/v1/contabilidad/asientos', { ...f, cuenta_contable: f.cuenta_contable || undefined })
    showToast('Asiento creado')
    await cargar()
  }

  return (
    <div>
      <div className="ctb-toolbar">
        <div className="ctb-field">
          <label>Desde</label>
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
        </div>
        <div className="ctb-field">
          <label>Hasta</label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
        </div>
        <button className="ctb-btn primary" onClick={cargar}>Consultar</button>
        {tienePermiso('contabilidad.gestionar') && (
          <button className="ctb-btn" onClick={() => setShowNuevo(true)}>+ Nuevo asiento</button>
        )}
        {tienePermiso('contabilidad.exportar') && (
          <button className="ctb-btn" onClick={() => descargarBlob(
            `/api/v1/contabilidad/libro-diario/excel?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`,
            `libro-diario-${fechaInicio}_${fechaFin}.xlsx`,
          )}>
            📥 Exportar Excel
          </button>
        )}
      </div>

      {cargando && <div className="spinner-center">Cargando...</div>}

      {!cargando && data && (
        <div className="ctb-tbl-wrap">
          <table className="ctb-tbl">
            <thead>
              <tr><th>Fecha</th><th>Nro. asiento</th><th>Tipo</th><th>Cuenta</th><th>Concepto</th><th>Debe</th><th>Haber</th><th>Saldo</th></tr>
            </thead>
            <tbody>
              {data.asientos.map(a => (
                <tr key={a.id}>
                  <td>{a.fecha.slice(0, 10)}</td>
                  <td>{a.numero_asiento ?? '—'}</td>
                  <td>{a.tipo}</td>
                  <td>{a.cuenta_contable ?? '—'}</td>
                  <td>{a.concepto}</td>
                  <td>{fmtMoneda(a.debe)}</td>
                  <td>{fmtMoneda(a.haber)}</td>
                  <td>{fmtMoneda(a.saldo)}</td>
                </tr>
              ))}
              {data.asientos.length === 0 && <tr><td colSpan={8} className="empty">Sin movimientos en el período</td></tr>}
            </tbody>
            {data.asientos.length > 0 && (
              <tfoot>
                <tr><td colSpan={5}>TOTALES</td><td>{fmtMoneda(data.total_debe)}</td><td>{fmtMoneda(data.total_haber)}</td><td>{fmtMoneda(data.saldo_final)}</td></tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {showNuevo && <NuevoAsientoModal onClose={() => setShowNuevo(false)} onSubmit={crearAsiento} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}

function TabPLE() {
  const [mes, setMes] = useState(mesActual())
  const [descargando, setDescargando] = useState<string | null>(null)

  const descargar = async (libro: 'ventas' | 'compras') => {
    setDescargando(libro)
    try {
      await descargarBlob(`/api/v1/contabilidad/libros-electronicos/ple?mes=${mes}&libro=${libro}`, `PLE-${libro}-${mes}.txt`)
    } finally { setDescargando(null) }
  }

  return (
    <div>
      <div className="ctb-warn">
        ⚠️ <strong>Exportación PLE experimental.</strong> Genera un archivo de texto delimitado por "|" siguiendo
        la estructura general de los libros PLE de SUNAT, pero <strong>no está validada contra el spec oficial vigente</strong>.
        Debe ser revisada por un contador (o contra el validador oficial de SUNAT) antes de presentarla.
      </div>

      <div className="ctb-toolbar">
        <div className="ctb-field">
          <label>Mes</label>
          <input type="month" value={mes} onChange={e => setMes(e.target.value)} />
        </div>
      </div>

      <div className="ctb-ple-actions">
        <button className="ctb-btn primary" disabled={descargando === 'ventas'} onClick={() => descargar('ventas')}>
          📥 Registro de ventas (.txt)
        </button>
        <button className="ctb-btn primary" disabled={descargando === 'compras'} onClick={() => descargar('compras')}>
          📥 Registro de compras (.txt)
        </button>
      </div>
    </div>
  )
}

function TabExportar() {
  const [periodo, setPeriodo] = useState(mesActual())

  return (
    <div>
      <div className="ctb-toolbar">
        <div className="ctb-field">
          <label>Mes</label>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} />
        </div>
      </div>
      <div className="ctb-ple-actions">
        <button className="ctb-btn primary" onClick={() => descargarBlob(`/api/v1/reportes/mensual/excel?mes=${periodo}`, `reporte-completo-${periodo}.xlsx`)}>
          📊 Reporte completo Excel
        </button>
        <button className="ctb-btn primary" onClick={() => descargarBlob(`/api/v1/reportes/mensual/pdf?mes=${periodo}`, `reporte-completo-${periodo}.pdf`)}>
          📄 Reporte completo PDF
        </button>
        <button className="ctb-btn" onClick={() => descargarBlob(
          `/api/v1/contabilidad/libro-diario/excel?fecha_inicio=${periodo}-01&fecha_fin=${periodo}-28`,
          `libro-diario-${periodo}.xlsx`,
        )}>
          📋 Exportar libro diario
        </button>
      </div>
    </div>
  )
}

export default function ContabilidadPage() {
  const [tab, setTab] = useState<Tab>('ventas')

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'ventas', label: '📊 Resumen de ventas' },
    { id: 'diario', label: '📗 Libro diario' },
    { id: 'ple', label: '📘 Libros electrónicos' },
    { id: 'exportar', label: '📥 Exportar' },
  ]

  return (
    <div className="ctb-root">
      <style>{css}</style>
      <div className="ctb-hd">
        <div className="ctb-title">💰 Contabilidad</div>
        <div className="ctb-tabs">
          {tabs.map(t => (
            <button key={t.id} className={`ctb-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="ctb-body">
        {tab === 'ventas' && <TabResumenVentas />}
        {tab === 'diario' && <TabLibroDiario />}
        {tab === 'ple' && <TabPLE />}
        {tab === 'exportar' && <TabExportar />}
      </div>
    </div>
  )
}
