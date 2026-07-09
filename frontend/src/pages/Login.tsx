import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

interface LoginResponse {
  token: string
  personal: {
    esGlobal: boolean
    locales: Array<{
      local_id: string
      local_nombre: string
      local_color: string
      rol: string
      es_local_principal: boolean
    }>
  }
  catalogoPermisos: Record<string, string[]>
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<LoginResponse>('/api/v1/auth/login', { email, password })
      localStorage.setItem('token', data.token)
      localStorage.setItem('catalogoPermisos', JSON.stringify(data.catalogoPermisos))
      localStorage.setItem('localesInfo', JSON.stringify(data.personal.locales))

      const principal = data.personal.locales.find(l => l.es_local_principal) ?? data.personal.locales[0]
      if (principal) localStorage.setItem('activeLocalId', principal.local_id)
      else localStorage.removeItem('activeLocalId')

      navigate('/dashboard')
    } catch {
      setError('Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4">
            <span className="text-white text-2xl font-bold">H</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Hotel PMS</h1>
          <p className="text-text-tertiary text-sm mt-1">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-2xl p-8 space-y-5 shadow-xl">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="admin@hotel.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
          >
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
