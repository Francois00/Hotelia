import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import api from '../../api/client'

interface Turno {
  id: string; tipo: string; estado: string
  hora_apertura: string; hora_cierre?: string | null
  saldo_inicial: number
  recepcionista: { nombre: string; apellido: string }
  _count?: { pagos: number }
}

interface TurnosResp { data: Turno[]; meta: { total: number; page: number } }

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)

export default function HistorialTurnosPage() {
  const [filtros, setFiltros] = useState({ fecha: '', tipo: '', page: 1 })

  const { data } = useQuery<TurnosResp>({
    queryKey: ['turnos-historial', filtros],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('limit', '20')
      params.set('page', String(filtros.page))
      if (filtros.fecha) params.set('fecha', filtros.fecha)
      if (filtros.tipo) params.set('tipo', filtros.tipo)
      return api.get<TurnosResp>(`/api/v1/turnos?${params}`).then(r => r.data)
    },
  })

  const turnos = data?.data ?? []
  const total = data?.meta.total ?? 0
  const pages = Math.ceil(total / 20)

  const downloadPdf = async (id: string) => {
    try {
      const response = await api.get(`/api/v1/turnos/${id}/reporte/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-turno-${id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { /* silencioso */ }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historial de Turnos</h1>
        <p className="text-gray-500 text-sm mt-0.5">Consulta y descarga reportes de turnos anteriores</p>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="date"
          value={filtros.fecha}
          onChange={e => setFiltros(f => ({ ...f, fecha: e.target.value, page: 1 }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filtros.tipo}
          onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value, page: 1 }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los tipos</option>
          <option value="DIA">DÍA</option>
          <option value="NOCHE">NOCHE</option>
        </select>
        <button
          onClick={() => setFiltros({ fecha: '', tipo: '', page: 1 })}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
        >
          Limpiar
        </button>
        <span className="text-xs text-gray-400 ml-auto">{total} registros</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Fecha', 'Tipo', 'Recepcionista', 'Apertura', 'Cierre', 'Trans.', 'Saldo ini.', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {turnos.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Sin resultados</td></tr>
              )}
              {turnos.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {format(new Date(t.hora_apertura), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.tipo === 'DIA' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                      {t.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{t.recepcionista.nombre} {t.recepcionista.apellido}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(t.hora_apertura).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {t.hora_cierre
                      ? new Date(t.hora_cierre).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
                      : <span className="text-green-600 font-medium">Abierto</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t._count?.pagos ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">{formatCurrency(t.saldo_inicial)}</td>
                  <td className="px-4 py-3">
                    {t.estado === 'CERRADO' && (
                      <button onClick={() => void downloadPdf(t.id)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        Ver PDF
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <button
              disabled={filtros.page <= 1}
              onClick={() => setFiltros(f => ({ ...f, page: f.page - 1 }))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              ← Anterior
            </button>
            <span className="text-sm text-gray-500">Página {filtros.page} de {pages}</span>
            <button
              disabled={filtros.page >= pages}
              onClick={() => setFiltros(f => ({ ...f, page: f.page + 1 }))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
