import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRol } from '../hooks/useRol'
import api from '../api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Categoria {
  id: string
  nombre: string
  icono: string
  color: string
  total_articulos: number
  alertas: number
}

interface Articulo {
  id: string
  nombre: string
  unidad: string
  stock_actual: number
  stock_minimo: number
  stock_optimo: number
  costo_promedio: number
  proveedor_habitual: string | null
  categoria_id: string
  categoria_nombre: string
  categoria_color: string
  categoria_icono: string
}

interface Dashboard {
  total: number
  normal: number
  bajo: number
  critico: number
  valor_total: number
  alertas: Array<{ articulo: string; unidad: string; stock_actual: number; stock_minimo: number }>
}

interface Movimiento {
  id: string
  tipo: string
  cantidad: number
  stock_resultante: number
  precio_unitario: number | null
  motivo: string | null
  created_at: string
  articulo_nombre: string
  articulo_unidad: string
  personal_nombre: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stockPct(art: Articulo) {
  if (art.stock_optimo <= 0) return 100
  return Math.min(100, Math.round((art.stock_actual / art.stock_optimo) * 100))
}

function stockColor(art: Articulo) {
  if (art.stock_actual === 0) return 'bg-red-500'
  if (art.stock_actual <= art.stock_minimo) return 'bg-orange-400'
  return 'bg-green-500'
}

function EstadoBadge({ art }: { art: Articulo }) {
  if (art.stock_actual === 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Sin stock</span>
  if (art.stock_actual <= art.stock_minimo) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Bajo mínimo</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Normal</span>
}

// ─── Modal Movimiento ─────────────────────────────────────────────────────────

function ModalMovimiento({
  tipo, articulo, onClose, onDone,
}: {
  tipo: 'entrada' | 'salida'
  articulo: Articulo
  onClose: () => void
  onDone: () => void
}) {
  const [cantidad, setCantidad] = useState('')
  const [precio, setPrecio] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!cantidad || Number(cantidad) <= 0) { setError('Cantidad debe ser > 0'); return }
    setLoading(true); setError('')
    try {
      const body: Record<string, unknown> = { articulo_id: articulo.id, cantidad: Number(cantidad), motivo }
      if (tipo === 'entrada' && precio) body.precio_unitario = Number(precio)
      await api.post(`/api/v1/almacen/movimientos/${tipo}`, body)
      onDone()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Error al registrar movimiento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-gray-800 text-lg mb-1">
          {tipo === 'entrada' ? '📦 Registrar Entrada' : '📤 Registrar Salida'}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {articulo.nombre} — stock actual: <span className="font-medium text-gray-700">{articulo.stock_actual} {articulo.unidad}</span>
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad *</label>
            <input
              type="number" min="0.01" step="0.01"
              value={cantidad} onChange={e => setCantidad(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
              placeholder={`En ${articulo.unidad}`}
            />
          </div>
          {tipo === 'entrada' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Precio unitario (S/)</label>
              <input
                type="number" min="0" step="0.01"
                value={precio} onChange={e => setPrecio(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                placeholder={`Actual: S/ ${articulo.costo_promedio.toFixed(2)}`}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Motivo</label>
            <input
              value={motivo} onChange={e => setMotivo(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
              placeholder={tipo === 'entrada' ? 'Ej: Compra mensual' : 'Ej: Uso habitación 101'}
            />
          </div>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={submit} disabled={loading}
            className={`flex-1 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50 ${
              tipo === 'entrada' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {loading ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Drawer Historial ─────────────────────────────────────────────────────────

function DrawerHistorial({ articulo, onClose }: { articulo: Articulo; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['almacen-movimientos', articulo.id],
    queryFn: () => api.get<{ data: Movimiento[] }>(`/api/v1/almacen/movimientos?articulo_id=${articulo.id}&limit=30`).then(r => r.data),
  })

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-96 bg-white h-full shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">{articulo.nombre}</h3>
            <p className="text-xs text-gray-500">Historial de movimientos</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-center text-gray-400 text-sm py-8">Cargando...</p>
          ) : !data?.data.length ? (
            <p className="text-center text-gray-400 text-sm py-8">Sin movimientos registrados</p>
          ) : (
            <div className="space-y-2">
              {data.data.map(m => (
                <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <span className="text-lg mt-0.5">
                    {m.tipo === 'entrada' ? '📥' : m.tipo === 'salida' ? '📤' : '🔄'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium capitalize ${
                        m.tipo === 'entrada' ? 'text-green-700' : m.tipo === 'salida' ? 'text-orange-700' : 'text-blue-700'
                      }`}>
                        {m.tipo}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(m.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 font-medium">
                      {m.tipo === 'entrada' ? '+' : '−'}{m.cantidad} {articulo.unidad}
                      {' → '}
                      <span className="text-gray-500">{m.stock_resultante} restantes</span>
                    </p>
                    {m.motivo && <p className="text-xs text-gray-500 truncate">{m.motivo}</p>}
                    {m.personal_nombre && <p className="text-xs text-gray-400">{m.personal_nombre}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlmacenPage() {
  const { isGerente } = useRol()
  const qc = useQueryClient()

  const [catActiva, setCatActiva] = useState<string | null>(null)
  const [filtroAlerta, setFiltroAlerta] = useState(false)
  const [modalTipo, setModalTipo] = useState<'entrada' | 'salida' | null>(null)
  const [artSelec, setArtSelec] = useState<Articulo | null>(null)
  const [historialArt, setHistorialArt] = useState<Articulo | null>(null)

  const { data: dashboard } = useQuery<Dashboard>({
    queryKey: ['almacen-dashboard'],
    queryFn: () => api.get<Dashboard>('/api/v1/almacen/dashboard').then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ['almacen-categorias'],
    queryFn: () => api.get<Categoria[]>('/api/v1/almacen/categorias').then(r => r.data),
  })

  const artParams = new URLSearchParams()
  if (catActiva) artParams.set('categoria_id', catActiva)
  if (filtroAlerta) artParams.set('alerta', '1')

  const { data: articulos = [], isLoading } = useQuery<Articulo[]>({
    queryKey: ['almacen-articulos', catActiva, filtroAlerta],
    queryFn: () => api.get<Articulo[]>(`/api/v1/almacen/articulos?${artParams.toString()}`).then(r => r.data),
  })

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['almacen-articulos'] })
    void qc.invalidateQueries({ queryKey: ['almacen-dashboard'] })
    void qc.invalidateQueries({ queryKey: ['almacen-categorias'] })
    if (historialArt) void qc.invalidateQueries({ queryKey: ['almacen-movimientos', historialArt.id] })
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-800">📦 Almacén e Inventario</h1>
        <p className="text-sm text-gray-500 mt-0.5">Control de stock y movimientos</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Dashboard cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total artículos', value: dashboard?.total ?? 0, cls: 'bg-blue-50 text-blue-700', fn: () => { setCatActiva(null); setFiltroAlerta(false) } },
            { label: 'Stock normal', value: dashboard?.normal ?? 0, cls: 'bg-green-50 text-green-700', fn: () => { setCatActiva(null); setFiltroAlerta(false) } },
            { label: 'Stock bajo', value: dashboard?.bajo ?? 0, cls: 'bg-orange-50 text-orange-700', fn: () => setFiltroAlerta(true) },
            { label: 'Sin stock', value: dashboard?.critico ?? 0, cls: 'bg-red-50 text-red-700', fn: () => setFiltroAlerta(true) },
          ].map(c => (
            <button key={c.label} onClick={c.fn} className={`${c.cls} rounded-xl p-4 text-left hover:opacity-80 transition-opacity`}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-sm font-medium mt-0.5">{c.label}</p>
            </button>
          ))}
        </div>

        {dashboard && dashboard.valor_total > 0 && (
          <p className="text-sm text-gray-500">
            Valor total en inventario:{' '}
            <span className="font-semibold text-gray-700">
              S/ {dashboard.valor_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </span>
          </p>
        )}

        {/* Tabs categorías */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setCatActiva(null); setFiltroAlerta(false) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              catActiva === null && !filtroAlerta ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {categorias.map(c => (
            <button
              key={c.id}
              onClick={() => { setCatActiva(c.id); setFiltroAlerta(false) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                catActiva === c.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{c.icono}</span>
              {c.nombre}
              {c.alertas > 0 && (
                <span className={`ml-1 px-1.5 rounded-full text-xs ${catActiva === c.id ? 'bg-white/30 text-white' : 'bg-orange-100 text-orange-700'}`}>
                  {c.alertas}
                </span>
              )}
            </button>
          ))}
          {filtroAlerta && (
            <button onClick={() => setFiltroAlerta(false)} className="px-3 py-1.5 rounded-full text-xs font-medium bg-orange-500 text-white">
              ⚠ Alertas × cerrar
            </button>
          )}
        </div>

        {/* Tabla artículos */}
        <div className="bg-white rounded-xl border overflow-hidden">
          {isLoading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Cargando artículos...</div>
          ) : articulos.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No hay artículos en esta categoría</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Artículo</th>
                  <th className="text-left px-4 py-3 font-medium">Stock</th>
                  <th className="text-left px-4 py-3 font-medium w-28">Nivel</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 font-medium">Costo</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {articulos.map(art => (
                  <tr key={art.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{art.nombre}</div>
                      <div className="text-xs text-gray-400">{art.categoria_icono} {art.categoria_nombre} · {art.unidad}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-800">{art.stock_actual}</span>
                      <span className="text-gray-400 text-xs"> / {art.stock_optimo}</span>
                      <div className="text-xs text-gray-400">Mín: {art.stock_minimo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${stockColor(art)}`} style={{ width: `${stockPct(art)}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{stockPct(art)}%</p>
                    </td>
                    <td className="px-4 py-3"><EstadoBadge art={art} /></td>
                    <td className="px-4 py-3 text-gray-600 text-xs">S/ {art.costo_promedio.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setHistorialArt(art)} className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                          Historial
                        </button>
                        {isGerente && (
                          <>
                            <button onClick={() => { setArtSelec(art); setModalTipo('entrada') }} className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200">
                              + Entrada
                            </button>
                            <button
                              onClick={() => { setArtSelec(art); setModalTipo('salida') }}
                              disabled={art.stock_actual <= 0}
                              className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              − Salida
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Alertas panel */}
        {dashboard && dashboard.alertas.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-orange-800 mb-2">⚠ Artículos bajo el mínimo</h3>
            <div className="grid grid-cols-2 gap-2">
              {dashboard.alertas.map(a => (
                <div key={a.articulo} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                  <span className="text-orange-800 font-medium truncate">{a.articulo}</span>
                  <span className="text-orange-600 text-xs shrink-0">{a.stock_actual}/{a.stock_minimo}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalTipo && artSelec && (
        <ModalMovimiento
          tipo={modalTipo}
          articulo={artSelec}
          onClose={() => { setModalTipo(null); setArtSelec(null) }}
          onDone={() => { setModalTipo(null); setArtSelec(null); invalidar() }}
        />
      )}

      {/* Historial drawer */}
      {historialArt && (
        <DrawerHistorial articulo={historialArt} onClose={() => setHistorialArt(null)} />
      )}
    </div>
  )
}
