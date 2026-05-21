import { NavLink } from 'react-router-dom'
import { useRol } from '../hooks/useRol'

export default function Sidebar() {
  const { isGerente, isRecepcionista, isHousekeeping, isMantenimiento } = useRol()
  const isOperativo = isHousekeeping || isMantenimiento

  const handleLogout = () => {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  return (
    <aside className="w-60 bg-gray-900 flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">H</div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Hotel PMS</p>
            <p className="text-gray-400 text-xs">Sistema de Gestión</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <NavItem to="/dashboard" icon="⊞" label="Dashboard" />

        {/* Habitaciones: todos los roles operativos */}
        <NavItem to="/habitaciones" icon="⊡" label="Habitaciones" />
        {isGerente && (
          <>
            <SubItem to="/habitaciones/tipos" label="Tipos" />
            <SubItem to="/habitaciones/tarifas" label="Reglas de tarifa" />
          </>
        )}

        {/* Reservas y check-in: solo recepción/gerente */}
        {isRecepcionista && (
          <>
            <NavItem to="/reservas" icon="⊟" label="Reservas" />
            <NavItem to="/checkin" icon="✅" label="Check-in Manual" highlight />
            <NavItem to="/checkin-qr" icon="📱" label="Check-in QR" />
          </>
        )}

        {/* Revenue y CRM: solo gerente */}
        {isGerente && (
          <>
            <NavItem to="/revenue" icon="⊠" label="Revenue" />
            <NavItem to="/crm" icon="⊕" label="CRM" />
            <NavItem to="/channel-manager" icon="📡" label="Channel Manager" />
            <NavItem to="/notificaciones" icon="🔔" label="Notificaciones" />
            <NavItem to="/concierge-test" icon="🤖" label="Test Concierge IA" />
          </>
        )}

        {/* Almacén: gerente y recepcionista */}
        {isRecepcionista && (
          <NavItem to="/almacen" icon="📦" label="Almacén" />
        )}

        {/* Concierge IA: recepción y gerente */}
        {isRecepcionista && (
          <NavItem to="/concierge" icon="💬" label="Concierge IA" />
        )}

        {/* Turno de caja */}
        {(isRecepcionista || isOperativo) && (
          <div className="pt-3 pb-1">
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Turno de caja</p>
          </div>
        )}
        {isRecepcionista && <NavItem to="/turno" icon="💰" label="Turno activo" />}
        {isGerente && <NavItem to="/turnos/historial" icon="📋" label="Historial" />}
      </nav>

      <div className="px-3 py-4 border-t border-gray-700/50">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span className="text-base">↩</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

function NavItem({ to, icon, label, highlight }: { to: string; icon: string; label: string; highlight?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to !== '/habitaciones'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-600 text-white'
            : highlight
            ? 'text-blue-400 hover:bg-gray-800 hover:text-blue-300'
            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`
      }
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
    </NavLink>
  )
}

function SubItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 pl-8 pr-3 py-2 rounded-lg text-xs font-medium transition-colors ${
          isActive ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
        }`
      }
    >
      <span className="w-1 h-1 rounded-full bg-current" />
      {label}
    </NavLink>
  )
}
