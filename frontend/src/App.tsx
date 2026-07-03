import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PrivateRoute from './components/PrivateRoute'
import RoleRoute from './components/RoleRoute'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { useRol } from './hooks/useRol'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Habitaciones from './pages/Habitaciones'
import TiposHabitacionPage from './pages/habitaciones/TiposHabitacionPage'
import ReglasTarifaPage from './pages/habitaciones/ReglasTarifaPage'
import Reservas from './pages/Reservas'
import Revenue from './pages/Revenue'
import CRM from './pages/CRM'
import ConciergeIA from './pages/ConciergeIA'
import CheckinQR from './pages/CheckinQR'
import CheckinManualPage from './pages/checkin/CheckinManualPage'
import TurnoActivoPage from './pages/turno/TurnoActivoPage'
import HistorialTurnosPage from './pages/turno/HistorialTurnosPage'
import CheckoutPage from './pages/checkout/CheckoutPage'
import ChannelManagerPage from './pages/ChannelManagerPage'
import NotificacionesPage from './pages/NotificacionesPage'
import ConciergeTestPage from './pages/ConciergeTestPage'
import AlmacenPage from './pages/AlmacenPage'
import HousekeepingPage from './pages/HousekeepingPage'
import CalendarioPage from './pages/CalendarioPage'
import ConfiguracionPage from './pages/ConfiguracionPage'
import GestionLocalesPage from './pages/GestionLocalesPage'
import GestionPersonalPage from './pages/GestionPersonalPage'
import ContabilidadPage from './pages/ContabilidadPage'
import DashboardConsolidadoPage from './pages/DashboardConsolidadoPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: 1,
    },
  },
})

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <PrivateRoute>
      <Layout>
        <ErrorBoundary>{children}</ErrorBoundary>
      </Layout>
    </PrivateRoute>
  )
}

// Rutas gateadas por un permiso granular específico (ver catálogo en backend/prisma/seed-catalogo-roles.sql)
function PermisoPage({ children, permiso }: { children: React.ReactNode; permiso: string }) {
  return (
    <RoleRoute requierePermiso={permiso}>
      <Layout>
        <ErrorBoundary>{children}</ErrorBoundary>
      </Layout>
    </RoleRoute>
  )
}

// Rutas gateadas por nivel jerárquico (esGlobal o gerente_local) en vez de un permiso puntual —
// para pantallas que no tienen un permiso dedicado propio.
function NivelAltoPage({ children }: { children: React.ReactNode }) {
  const { esNivelAlto } = useRol()
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  if (!esNivelAlto) return <Navigate to="/dashboard" replace />
  return (
    <Layout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </Layout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
          <Route path="/dashboard-consolidado" element={<PermisoPage permiso="dashboard.consolidado.ver"><DashboardConsolidadoPage /></PermisoPage>} />

          {/* Habitaciones */}
          <Route path="/habitaciones" element={<ProtectedPage><Habitaciones /></ProtectedPage>} />
          <Route path="/habitaciones/tipos" element={<PermisoPage permiso="habitaciones.tipos.gestionar"><TiposHabitacionPage /></PermisoPage>} />
          <Route path="/habitaciones/tarifas" element={<PermisoPage permiso="tarifas.reglas.gestionar"><ReglasTarifaPage /></PermisoPage>} />

          {/* Reservas y check-in */}
          <Route path="/reservas" element={<ProtectedPage><Reservas /></ProtectedPage>} />
          <Route path="/checkin" element={<ProtectedPage><CheckinManualPage /></ProtectedPage>} />
          <Route path="/checkin-qr" element={<ProtectedPage><CheckinQR /></ProtectedPage>} />
          <Route path="/checkout/:reservaId" element={<ProtectedPage><CheckoutPage /></ProtectedPage>} />

          {/* Turno */}
          <Route path="/turno" element={<ProtectedPage><TurnoActivoPage /></ProtectedPage>} />
          <Route path="/turnos/historial" element={<PermisoPage permiso="turnos.ver_todos"><HistorialTurnosPage /></PermisoPage>} />

          {/* Otros */}
          <Route path="/revenue" element={<ProtectedPage><Revenue /></ProtectedPage>} />
          <Route path="/crm" element={<ProtectedPage><CRM /></ProtectedPage>} />
          <Route path="/concierge" element={<ProtectedPage><ConciergeIA /></ProtectedPage>} />
          <Route path="/channel-manager" element={<PermisoPage permiso="channel_manager.gestionar"><ChannelManagerPage /></PermisoPage>} />
          <Route path="/notificaciones" element={<NivelAltoPage><NotificacionesPage /></NivelAltoPage>} />
          <Route path="/concierge-test" element={<NivelAltoPage><ConciergeTestPage /></NivelAltoPage>} />
          <Route path="/almacen" element={<ProtectedPage><AlmacenPage /></ProtectedPage>} />
          <Route path="/housekeeping" element={<ProtectedPage><HousekeepingPage /></ProtectedPage>} />
          <Route path="/calendario" element={<ProtectedPage><CalendarioPage /></ProtectedPage>} />
          <Route path="/configuracion" element={<NivelAltoPage><ConfiguracionPage /></NivelAltoPage>} />

          {/* Multi-local */}
          <Route path="/locales" element={<PermisoPage permiso="locales.gestionar"><GestionLocalesPage /></PermisoPage>} />
          <Route path="/personal" element={<PermisoPage permiso="personal.gestionar"><GestionPersonalPage /></PermisoPage>} />
          <Route path="/contabilidad" element={<PermisoPage permiso="contabilidad.ver"><ContabilidadPage /></PermisoPage>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
