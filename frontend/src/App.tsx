import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PrivateRoute from './components/PrivateRoute'
import RoleRoute from './components/RoleRoute'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
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

function GerentePage({ children }: { children: React.ReactNode }) {
  return (
    <RoleRoute requireGerente>
      <Layout>
        <ErrorBoundary>{children}</ErrorBoundary>
      </Layout>
    </RoleRoute>
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

          {/* Habitaciones */}
          <Route path="/habitaciones" element={<ProtectedPage><Habitaciones /></ProtectedPage>} />
          <Route path="/habitaciones/tipos" element={<GerentePage><TiposHabitacionPage /></GerentePage>} />
          <Route path="/habitaciones/tarifas" element={<GerentePage><ReglasTarifaPage /></GerentePage>} />

          {/* Reservas y check-in */}
          <Route path="/reservas" element={<ProtectedPage><Reservas /></ProtectedPage>} />
          <Route path="/checkin" element={<ProtectedPage><CheckinManualPage /></ProtectedPage>} />
          <Route path="/checkin-qr" element={<ProtectedPage><CheckinQR /></ProtectedPage>} />
          <Route path="/checkout/:reservaId" element={<ProtectedPage><CheckoutPage /></ProtectedPage>} />

          {/* Turno */}
          <Route path="/turno" element={<ProtectedPage><TurnoActivoPage /></ProtectedPage>} />
          <Route path="/turnos/historial" element={<GerentePage><HistorialTurnosPage /></GerentePage>} />

          {/* Otros */}
          <Route path="/revenue" element={<ProtectedPage><Revenue /></ProtectedPage>} />
          <Route path="/crm" element={<ProtectedPage><CRM /></ProtectedPage>} />
          <Route path="/concierge" element={<ProtectedPage><ConciergeIA /></ProtectedPage>} />
          <Route path="/channel-manager" element={<GerentePage><ChannelManagerPage /></GerentePage>} />
          <Route path="/notificaciones" element={<GerentePage><NotificacionesPage /></GerentePage>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
