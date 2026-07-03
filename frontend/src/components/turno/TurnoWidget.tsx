import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import { tienePermiso } from '../../utils/auth'
import AbrirTurnoModal from './AbrirTurnoModal'

interface TurnoActivo {
  turno: {
    id: string
    tipo: 'DIA' | 'NOCHE'
    hora_apertura: string
    recepcionista: { nombre: string; apellido: string }
    saldo_inicial: number
  }
  resumen: {
    total_general: number
    efectivo_neto: number
  }
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)

function horaDesde(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export default function TurnoWidget() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  if (!tienePermiso('turnos.gestionar')) return null

  const { data, isError } = useQuery<TurnoActivo | null>({
    queryKey: ['turno-activo-widget'],
    queryFn: () => api.get<TurnoActivo>('/api/v1/turnos/activo')
      .then(r => r.data)
      .catch(() => null),
    refetchInterval: 60000,
    retry: false,
  })

  const handleOpened = () => {
    void queryClient.invalidateQueries({ queryKey: ['turno-activo-widget'] })
  }

  if (isError || data === undefined) return null

  return (
    <>
      {showModal && (
        <AbrirTurnoModal onClose={() => setShowModal(false)} onOpened={handleOpened} />
      )}

      <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 rounded-xl text-sm">
        {data?.turno ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
            <span className="text-gray-300 font-medium whitespace-nowrap">
              TURNO {data.turno.tipo} · desde {horaDesde(data.turno.hora_apertura)}
            </span>
            <span className="text-white font-bold whitespace-nowrap">
              {formatCurrency(data.resumen.total_general)}
            </span>
            <button
              onClick={() => navigate('/turno')}
              className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 whitespace-nowrap"
            >
              Ver turno
            </button>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <span className="text-gray-400 whitespace-nowrap">Sin turno activo</span>
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 whitespace-nowrap"
            >
              Abrir turno
            </button>
          </>
        )}
      </div>
    </>
  )
}
