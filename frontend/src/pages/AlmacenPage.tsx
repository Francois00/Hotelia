import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useRol } from '../hooks/useRol'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Categoria { id: string; nombre: string; icono?: string; cantidad?: number }
interface Producto {
  id: string; nombre: string; sku?: string; categoria_id: string
  stock_actual: number; stock_minimo: number; unidad: string
  precio_unitario: number; ubicacion?: string; proveedor?: string
  ultimo_movimiento?: string
}
interface Movimiento { id: string; producto_id: string; tipo: 'entrada' | 'salida'; cantidad: number; fecha: string; motivo?: string; usuario_nombre?: string }

// Paleta ligada a los theme tokens (theme.css) — cambia sola con [data-theme].
const C = {
  bg: 'var(--bg-primary)', surface: 'var(--bg-secondary)', surface2: 'var(--bg-card)', surface3: 'var(--bg-tertiary)',
  border: 'var(--border-primary)', border2: 'var(--border-secondary)',
  text: 'var(--text-primary)', text2: 'var(--text-secondary)', text3: 'var(--text-tertiary)',
  green: 'var(--estado-disponible)', blue: 'var(--estado-ocupada)', yellow: 'var(--estado-limpieza)', red: 'var(--estado-mantenimiento)',
  gold: 'var(--brand-accent)',
}

const css = `
.alm{display:flex;height:100%;background:${C.bg};color:${C.text};font-family:-apple-system,BlinkMacSystemFont,sans-serif;}
.alm *{box-sizing:border-box;}
.cat-rail{width:220px;flex-shrink:0;background:${C.surface};border-right:1px solid ${C.border};display:flex;flex-direction:column;overflow:hidden;}
.cat-hd{padding:16px;border-bottom:1px solid ${C.border};font-size:13px;font-weight:700;color:${C.text3};text-transform:uppercase;letter-spacing:0.06em;}
.cat-list{flex:1;overflow-y:auto;padding:8px;}
.cat-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;margin-bottom:2px;transition:background 0.15s;border:1px solid transparent;}
.cat-item:hover{background:${C.surface2};}
.cat-item.on{background:rgba(77,150,255,0.1);border-color:rgba(77,150,255,0.25);}
.cat-ic{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;background:${C.surface3};flex-shrink:0;}
.cat-name{font-size:13px;font-weight:500;color:${C.text};flex:1;}
.cat-n{font-size:11px;color:${C.text3};font-weight:600;}
.cat-item.on .cat-name{color:${C.blue};}
.cat-item.on .cat-n{color:${C.blue};opacity:0.7;}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.toolbar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid ${C.border};flex-shrink:0;background:${C.surface};}
.search-wrap{position:relative;flex:1;max-width:320px;}
.search-wrap input{width:100%;background:${C.surface2};border:1px solid ${C.border};border-radius:8px;padding:8px 10px 8px 32px;font-size:13px;color:${C.text};outline:none;}
.search-wrap input:focus{border-color:${C.border2};}
.search-wrap input::placeholder{color:${C.text3};}
.search-ic{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:${C.text3};font-size:14px;pointer-events:none;}
.tb-spacer{flex:1;}
.tb-btn{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;}
.tb-btn.outline{background:transparent;color:${C.text2};border:1px solid ${C.border2};}
.tb-btn.outline:hover{color:${C.text};}
.tb-btn.green{background:rgba(34,197,94,0.12);color:${C.green};}
.tb-btn.red{background:rgba(239,68,68,0.1);color:${C.red};}
.tb-btn.yellow{background:rgba(234,179,8,0.1);color:${C.yellow};}
.sort-btn{background:${C.surface2};border:1px solid ${C.border};border-radius:6px;color:${C.text2};font-size:11px;padding:5px 8px;cursor:pointer;}
.sort-btn.on{border-color:${C.border2};color:${C.text};}
.tbl-wrap{flex:1;overflow-y:auto;}
.tbl{width:100%;border-collapse:collapse;}
.tbl thead tr{background:${C.surface2};}
.tbl th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:${C.text3};text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid ${C.border};white-space:nowrap;cursor:pointer;user-select:none;}
.tbl th:hover{color:${C.text2};}
.tbl td{padding:12px 14px;border-bottom:1px solid ${C.border};font-size:13px;color:${C.text};}
.tbl tr:hover td{background:rgba(255,255,255,0.02);}
.tbl tr.row-click{cursor:pointer;}
.sku{font-size:11px;color:${C.text3};font-family:monospace;}
.stock-num{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;}
.stock-bar-bg{width:80px;height:6px;background:${C.surface3};border-radius:3px;overflow:hidden;margin-top:4px;}
.stock-bar-fg{height:100%;border-radius:3px;transition:width 0.3s;}
.badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700;}
.badge.ok{background:rgba(34,197,94,0.12);color:${C.green};}.badge.low{background:rgba(234,179,8,0.12);color:${C.yellow};}.badge.out{background:rgba(239,68,68,0.12);color:${C.red};}
.act-btn{background:${C.surface2};border:1px solid ${C.border};border-radius:6px;padding:5px 10px;font-size:11px;color:${C.text2};cursor:pointer;display:inline-flex;align-items:center;gap:4px;}
.act-btn:hover{border-color:${C.border2};color:${C.text};}
.empty{text-align:center;color:${C.text3};font-size:14px;padding:48px;}
.spinner-center{text-align:center;color:${C.text3};font-size:14px;padding:48px;}
.error-center{text-align:center;color:${C.text3};font-size:14px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;}
.retry-btn{padding:8px 16px;background:${C.surface2};border:1px solid ${C.border2};border-radius:8px;color:${C.text};cursor:pointer;font-size:13px;}
.scrim{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:200;cursor:pointer;}
.sheet{position:fixed;right:0;top:0;bottom:0;width:min(420px,100vw);background:${C.surface};border-left:1px solid ${C.border};z-index:201;display:flex;flex-direction:column;overflow:hidden;}
.sheet-hd{display:flex;align-items:center;gap:10px;padding:16px;border-bottom:1px solid ${C.border};flex-shrink:0;}
.sheet-num{font-size:20px;font-weight:800;color:${C.text};flex:1;}
.sheet-close{background:${C.surface3};border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${C.text2};flex-shrink:0;}
.sheet-body{flex:1;overflow-y:auto;padding:16px;}
.sheet-sec{margin-bottom:16px;}
.sheet-sec-hd{font-size:11px;font-weight:700;color:${C.text3};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.info-tile{background:${C.surface2};border-radius:8px;padding:10px 12px;}
.info-tile .k{font-size:10px;color:${C.text3};margin-bottom:3px;text-transform:uppercase;letter-spacing:0.04em;}
.info-tile .v{font-size:14px;font-weight:700;color:${C.text};}
.sheet-actions{padding:16px;border-top:1px solid ${C.border};flex-shrink:0;display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.big-btn{width:100%;padding:11px;border-radius:10px;border:none;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;}
.big-btn.green{background:rgba(34,197,94,0.12);color:${C.green};}.big-btn.red{background:rgba(239,68,68,0.1);color:${C.red};}.big-btn.blue{background:rgba(77,150,255,0.1);color:${C.blue};}
.move-log{display:flex;flex-direction:column;gap:8px;}
.move-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:${C.surface2};}
.move-ic{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
.move-ic.in{background:rgba(34,197,94,0.12);color:${C.green};}.move-ic.out{background:rgba(239,68,68,0.1);color:${C.red};}
.move-info{flex:1;}.move-name{font-size:13px;color:${C.text};font-weight:600;}.move-meta{font-size:11px;color:${C.text3};}
.move-qty{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;}
.move-qty.in{color:${C.green};}.move-qty.out{color:${C.red};}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:24px;width:min(400px,100vw);max-height:85vh;overflow-y:auto;}
.modal-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
.modal-title{font-size:16px;font-weight:700;color:${C.text};}
.form-field{margin-bottom:14px;}
.form-label{display:block;font-size:12px;font-weight:600;color:${C.text2};margin-bottom:5px;}
.form-input{width:100%;background:${C.surface2};border:1px solid ${C.border};border-radius:8px;padding:9px 12px;font-size:13px;color:${C.text};outline:none;}
.form-input:focus{border-color:${C.border2};}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.modal-actions{display:flex;gap:8px;margin-top:20px;}
.modal-cancel{flex:1;padding:10px;border-radius:8px;border:1px solid ${C.border2};background:transparent;color:${C.text2};cursor:pointer;font-size:13px;}
.modal-confirm{flex:1;padding:10px;border-radius:8px;border:none;font-size:13px;font-weight:700;cursor:pointer;}
.modal-confirm.green{background:rgba(34,197,94,0.2);color:${C.green};}.modal-confirm.red{background:rgba(239,68,68,0.15);color:${C.red};}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${C.surface};border:1px solid ${C.border2};border-radius:24px;padding:10px 20px;font-size:13px;color:${C.text};z-index:400;display:flex;align-items:center;gap:8px;box-shadow:0 8px 32px rgba(0,0,0,0.4);}
`

// ─── SubComponents ────────────────────────────────────────────────────────────
function StockCell({ actual, minimo, unidad }: { actual: number; minimo: number; unidad: string }) {
  const pct = minimo > 0 ? Math.min((actual / (minimo * 2)) * 100, 100) : 100
  const color = actual <= 0 ? C.red : actual <= minimo ? C.yellow : C.green
  const label = actual <= 0 ? 'out' : actual <= minimo ? 'low' : 'ok'
  const labelText = actual <= 0 ? 'Sin stock' : actual <= minimo ? 'Bajo' : 'OK'
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="stock-num" style={{ color }}>{actual}</span>
        <span style={{ fontSize: 11, color: C.text3 }}>{unidad}</span>
        <span className={`badge ${label}`}>{labelText}</span>
      </div>
      <div className="stock-bar-bg"><div className="stock-bar-fg" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  )
}

interface MovModalProps {
  producto: Producto; tipo: 'entrada' | 'salida'
  onClose: () => void; onConfirm: (qty: number, motivo: string) => Promise<void>
}
function MovModal({ producto, tipo, onClose, onConfirm }: MovModalProps) {
  const [qty, setQty] = useState(1)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (qty <= 0) return
    setSaving(true)
    await onConfirm(qty, motivo)
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span className="modal-title">{tipo === 'entrada' ? '📥 Registrar entrada' : '📤 Registrar salida'}</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ background: C.surface2, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{producto.nombre}</div>
          <div style={{ fontSize: 12, color: C.text3 }}>Stock actual: {producto.stock_actual} {producto.unidad}</div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Cantidad ({producto.unidad})</label>
            <input className="form-input" type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} />
          </div>
        </div>
        <div className="form-field">
          <label className="form-label">Motivo (opcional)</label>
          <input className="form-input" placeholder={tipo === 'entrada' ? 'Compra a proveedor' : 'Uso en limpieza'} value={motivo} onChange={e => setMotivo(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancelar</button>
          <button className={`modal-confirm ${tipo === 'entrada' ? 'green' : 'red'}`} onClick={submit} disabled={saving}>
            {saving ? 'Guardando...' : tipo === 'entrada' ? '✓ Registrar entrada' : '✓ Registrar salida'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AlmacenPage() {
  const { esNivelAlto: isGerente } = useRol()

  const [cats, setCats] = useState<Categoria[]>([])
  const [prods, setProds] = useState<Producto[]>([])
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [catSel, setCatSel] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<'nombre' | 'stock_actual' | 'precio_unitario'>('nombre')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [modal, setModal] = useState<{ tipo: 'entrada' | 'salida'; prodId: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const [rC, rP, rM] = await Promise.all([
        api.get('/api/v1/almacen/categorias').catch(() => ({ data: [] })),
        api.get('/api/v1/almacen/productos?limit=200'),
        api.get('/api/v1/almacen/movimientos?limit=50').catch(() => ({ data: [] })),
      ])
      setCats(rC.data?.data ?? rC.data ?? [])
      setProds(rP.data?.data ?? rP.data ?? [])
      setMovs(rM.data?.data ?? rM.data ?? [])
    } catch { setError('Error al cargar inventario') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2400) }

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  const registrarMov = useCallback(async (prodId: string, tipo: 'entrada' | 'salida', qty: number, motivo: string) => {
    await api.post('/api/v1/almacen/movimientos', { producto_id: prodId, tipo, cantidad: qty, motivo })
    const delta = tipo === 'entrada' ? qty : -qty
    setProds(prev => prev.map(p => p.id === prodId ? { ...p, stock_actual: p.stock_actual + delta } : p))
    showToast(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada`)
  }, [])

  const filtrados = prods
    .filter(p => !catSel || p.categoria_id === catSel)
    .filter(p => !search || p.nombre.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey]
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })

  const selectedProd = prods.find(p => p.id === selected)
  const modalProd = modal ? prods.find(p => p.id === modal.prodId) : null
  const prodMovs = selected ? movs.filter(m => m.producto_id === selected).slice(0, 10) : []

  const catIcons: Record<string, string> = { 'Limpieza': '🧹', 'Amenities': '🧴', 'Alimentos': '🍽', 'Bebidas': '🥤', 'Ropa blanca': '🛏', 'Papelería': '📄', 'Mantenimiento': '🔧' }

  return (
    <div className="alm" style={{ height: '100%' }}>
      <style>{css}</style>

      <nav className="cat-rail">
        <div className="cat-hd">Categorías</div>
        <div className="cat-list">
          <div className={`cat-item${catSel === null ? ' on' : ''}`} onClick={() => setCatSel(null)}>
            <div className="cat-ic">🗂</div>
            <span className="cat-name">Todos</span>
            <span className="cat-n">{prods.length}</span>
          </div>
          {cats.map(c => (
            <div key={c.id} className={`cat-item${catSel === c.id ? ' on' : ''}`} onClick={() => setCatSel(c.id)}>
              <div className="cat-ic">{c.icono ?? catIcons[c.nombre] ?? '📦'}</div>
              <span className="cat-name">{c.nombre}</span>
              <span className="cat-n">{c.cantidad ?? prods.filter(p => p.categoria_id === c.id).length}</span>
            </div>
          ))}
          {cats.length === 0 && !cargando && [...new Set(prods.map(p => p.categoria_id))].map(cid => (
            <div key={cid} className={`cat-item${catSel === cid ? ' on' : ''}`} onClick={() => setCatSel(cid)}>
              <div className="cat-ic">📦</div>
              <span className="cat-name">Cat. {cid.slice(0, 6)}</span>
              <span className="cat-n">{prods.filter(p => p.categoria_id === cid).length}</span>
            </div>
          ))}
        </div>
      </nav>

      <div className="main">
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-ic">🔍</span>
            <input placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="sort-btn" onClick={() => toggleSort('nombre')}>Nombre {sortKey === 'nombre' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button>
          <button className="sort-btn" onClick={() => toggleSort('stock_actual')}>Stock {sortKey === 'stock_actual' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button>
          <button className="sort-btn" onClick={() => toggleSort('precio_unitario')}>Precio {sortKey === 'precio_unitario' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button>
          <div className="tb-spacer" />
          {isGerente && (
            <>
              <button className="tb-btn outline" onClick={() => setModal(null)}>📋 Reorden</button>
              <button className="tb-btn green" onClick={() => selected ? setModal({ tipo: 'entrada', prodId: selected }) : showToast('Selecciona un producto')}>📥 Entrada</button>
              <button className="tb-btn red" onClick={() => selected ? setModal({ tipo: 'salida', prodId: selected }) : showToast('Selecciona un producto')}>📤 Salida</button>
            </>
          )}
        </div>

        <div className="tbl-wrap">
          {cargando && <div className="spinner-center">Cargando inventario...</div>}
          {error && <div className="error-center"><span>{error}</span><button className="retry-btn" onClick={cargar}>Reintentar</button></div>}
          {!cargando && !error && (
            <table className="tbl">
              <thead>
                <tr>
                  <th onClick={() => toggleSort('nombre')}>Producto {sortKey === 'nombre' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                  <th>Categoría</th>
                  <th onClick={() => toggleSort('stock_actual')}>Stock {sortKey === 'stock_actual' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                  <th>Mínimo</th>
                  <th onClick={() => toggleSort('precio_unitario')}>P. Unitario {sortKey === 'precio_unitario' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                  <th>Ubicación</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr><td colSpan={7} className="empty">Sin productos{catSel ? ' en esta categoría' : ''}</td></tr>
                )}
                {filtrados.map(p => {
                  const cat = cats.find(c => c.id === p.categoria_id)
                  return (
                    <tr key={p.id} className="row-click" style={{ background: selected === p.id ? 'rgba(77,150,255,0.06)' : undefined }} onClick={() => setSelected(p.id === selected ? null : p.id)}>
                      <td>
                        <div style={{ fontWeight: 600, color: C.text }}>{p.nombre}</div>
                        {p.sku && <div className="sku">SKU: {p.sku}</div>}
                      </td>
                      <td style={{ color: C.text2 }}>{cat?.nombre ?? '—'}</td>
                      <td><StockCell actual={p.stock_actual} minimo={p.stock_minimo} unidad={p.unidad} /></td>
                      <td style={{ color: C.text2, fontSize: 13 }}>{p.stock_minimo} {p.unidad}</td>
                      <td style={{ fontWeight: 600 }}>S/ {p.precio_unitario.toFixed(2)}</td>
                      <td style={{ color: C.text3, fontSize: 12 }}>{p.ubicacion ?? '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="act-btn" onClick={e => { e.stopPropagation(); setModal({ tipo: 'entrada', prodId: p.id }) }}>📥</button>
                          <button className="act-btn" onClick={e => { e.stopPropagation(); setModal({ tipo: 'salida', prodId: p.id }) }}>📤</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && selectedProd && (
        <>
          <div className="scrim" onClick={() => setSelected(null)} />
          <div className="sheet">
            <div className="sheet-hd">
              <span className="sheet-num">{selectedProd.nombre}</span>
              <button className="sheet-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="sheet-body">
              <div className="sheet-sec">
                <div className="sheet-sec-hd">Detalles</div>
                <div className="info-grid">
                  <div className="info-tile"><div className="k">Stock actual</div><div className="v" style={{ color: selectedProd.stock_actual <= selectedProd.stock_minimo ? C.yellow : C.green }}>{selectedProd.stock_actual} {selectedProd.unidad}</div></div>
                  <div className="info-tile"><div className="k">Stock mínimo</div><div className="v">{selectedProd.stock_minimo} {selectedProd.unidad}</div></div>
                  <div className="info-tile"><div className="k">Precio unitario</div><div className="v">S/ {selectedProd.precio_unitario.toFixed(2)}</div></div>
                  <div className="info-tile"><div className="k">Ubicación</div><div className="v" style={{ fontSize: 13 }}>{selectedProd.ubicacion ?? '—'}</div></div>
                </div>
                {selectedProd.proveedor && <div style={{ marginTop: 8, padding: '10px 12px', background: C.surface2, borderRadius: 8, fontSize: 13, color: C.text2 }}>Proveedor: {selectedProd.proveedor}</div>}
              </div>
              <div className="sheet-sec">
                <div className="sheet-sec-hd">Últimos movimientos</div>
                {prodMovs.length === 0 && <div style={{ color: C.text3, fontSize: 13 }}>Sin movimientos registrados</div>}
                <div className="move-log">
                  {prodMovs.map(m => (
                    <div key={m.id} className="move-row">
                      <div className={`move-ic ${m.tipo === 'entrada' ? 'in' : 'out'}`}>{m.tipo === 'entrada' ? '📥' : '📤'}</div>
                      <div className="move-info">
                        <div className="move-name">{m.tipo === 'entrada' ? 'Entrada' : 'Salida'}</div>
                        <div className="move-meta">{m.motivo ?? '—'} · {m.usuario_nombre ?? ''}</div>
                      </div>
                      <div className={`move-qty ${m.tipo === 'entrada' ? 'in' : 'out'}`}>{m.tipo === 'entrada' ? '+' : '-'}{m.cantidad}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="sheet-actions">
              <button className="big-btn green" onClick={() => setModal({ tipo: 'entrada', prodId: selected })}>📥 Entrada</button>
              <button className="big-btn red" onClick={() => setModal({ tipo: 'salida', prodId: selected })}>📤 Salida</button>
            </div>
          </div>
        </>
      )}

      {modal && modalProd && (
        <MovModal
          producto={modalProd}
          tipo={modal.tipo}
          onClose={() => setModal(null)}
          onConfirm={(qty, motivo) => registrarMov(modal.prodId, modal.tipo, qty, motivo)}
        />
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
