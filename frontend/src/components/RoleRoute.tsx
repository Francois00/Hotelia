import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { isGerente } from '../utils/auth'

export default function RoleRoute({ children, requireGerente = false }: {
  children: ReactNode
  requireGerente?: boolean
}) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  if (requireGerente && !isGerente()) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
