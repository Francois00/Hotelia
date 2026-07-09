import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRol } from '../hooks/useRol'

const ESTADO_BADGE: Record<string, { dot: string; label: string | null }> = {
  activo:       { dot: 'bg-green-500',  label: null },
  pausado:      { dot: 'bg-orange-500', label: 'Pausado' },
  remodelacion: { dot: 'bg-blue-500',   label: 'En remodelación' },
  inactivo:     { dot: 'bg-gray-500',   label: 'Inactivo' },
}

export default function SelectorLocal() {
  const { locales, localActivoId, esGlobal, cambiarLocalActivo } = useRol()
  const [abierto, setAbierto] = useState(false)
  const queryClient = useQueryClient()

  if (!esGlobal && locales.length <= 1) {
    const unico = locales[0]
    if (!unico) return null
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300">
        <span className="text-base leading-none">🏨</span>
        {unico.local_nombre}
      </div>
    )
  }

  const activo = locales.find(l => l.local_id === localActivoId)

  const seleccionar = (localId: string | null) => {
    cambiarLocalActivo(localId)
    queryClient.invalidateQueries()
    setAbierto(false)
    window.location.reload()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-200 hover:bg-gray-800 transition-colors"
      >
        <span className="text-base leading-none">🏨</span>
        {activo ? activo.local_nombre : esGlobal ? 'Todos los locales' : 'Seleccionar local'}
        <span className="text-xs text-text-secondary">▾</span>
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 mt-1 w-72 bg-bg-card rounded-xl shadow-xl border border-border-primary z-20 py-1.5">
            {locales.map(l => {
              const badge = ESTADO_BADGE.activo
              const esActivo = l.local_id === localActivoId
              return (
                <button
                  key={l.local_id}
                  onClick={() => seleccionar(l.local_id)}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-bg-secondary transition-colors text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                    <span>
                      <span className="block text-gray-800">{l.local_nombre}</span>
                      <span className="block text-xs text-text-tertiary">{l.rol}</span>
                    </span>
                  </span>
                  {esActivo && <span className="text-xs text-blue-600 font-medium">Activo</span>}
                </button>
              )
            })}
            {esGlobal && (
              <>
                <div className="my-1 border-t border-border-primary" />
                <button
                  onClick={() => seleccionar(null)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-bg-secondary transition-colors text-left"
                >
                  📊 Ver todos los locales
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
