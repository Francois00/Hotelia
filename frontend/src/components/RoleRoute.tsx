import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { tienePermiso } from '../utils/auth'

export default function RoleRoute({ children, requierePermiso }: {
  children: ReactNode
  requierePermiso?: string
}) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  if (requierePermiso && !tienePermiso(requierePermiso)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
