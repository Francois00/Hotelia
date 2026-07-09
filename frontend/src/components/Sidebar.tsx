import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useRol } from '../hooks/useRol'
import { useEmpresa } from '../hooks/useEmpresa'

export default function Sidebar() {
  const { esGlobal, esNivelAlto, tienePermiso } = useRol()
  const { nombreSistema, logoUrl, colorPrimario, esSuperadminPlataforma } = useEmpresa()

  useEffect(() => {
    document.documentElement.style.setProperty('--color-primario', colorPrimario)
  }, [colorPrimario])

  const handleLogout = () => {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  return (
    <aside className="w-60 bg-gray-900 flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={nombreSistema} className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              {nombreSistema.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-white font-semibold text-sm leading-tight">{nombreSistema}</p>
            <p className="text-gray-400 text-xs">Sistema de Gestión</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {/* ─── Principal ─────────────────────────────────────────────── */}
        <GroupLabel label="Principal" />
        {esGlobal && <NavItem to="/dashboard-consolidado" icon="🌐" label="Dashboard consolidado" />}
        <NavItem to="/dashboard" icon="⊞" label="Dashboard" />
        <NavItem to="/crm" icon="⊕" label="CRM" />
        {esNivelAlto && <NavItem to="/revenue" icon="⊠" label="Revenue" />}

        {/* ─── Operaciones ────────────────────────────────────────────── */}
        <GroupLabel label="Operaciones" />
        <NavItem to="/habitaciones" icon="⊡" label="Habitaciones" />
        {tienePermiso('habitaciones.tipos.gestionar') && <SubItem to="/habitaciones/tipos" label="Tipos" />}
        {tienePermiso('tarifas.reglas.gestionar') && <SubItem to="/habitaciones/tarifas" label="Reglas de tarifa" />}
        <NavItem to="/reservas" icon="⊟" label="Reservas" />
        {tienePermiso('checkin.ejecutar') && <NavItem to="/checkin" icon="✅" label="Check-in" highlight />}
        <NavItem to="/checkin-qr" icon="📱" label="Check-in QR" />
        {tienePermiso('reservas.gestionar') && <NavItem to="/concierge" icon="💬" label="Concierge IA" />}
        <NavItem to="/calendario" icon="📅" label="Calendario" />
        <NavItem to="/housekeeping" icon="🧹" label="Housekeeping" />
        {tienePermiso('turnos.gestionar') && <NavItem to="/turno" icon="💰" label="Turno activo" />}
        {tienePermiso('turnos.ver_todos') && <NavItem to="/turnos/historial" icon="📋" label="Historial de turnos" />}

        {/* ─── Almacén ────────────────────────────────────────────────── */}
        {(tienePermiso('almacen.administrar') || tienePermiso('almacen.movimiento.registrar')) && (
          <>
            <GroupLabel label="Almacén" />
            <NavItem to="/almacen" icon="📦" label="Almacén" />
          </>
        )}

        {/* ─── Contabilidad ───────────────────────────────────────────── */}
        {tienePermiso('contabilidad.ver') && (
          <>
            <GroupLabel label="Contabilidad" />
            <NavItem to="/contabilidad" icon="🧾" label="Contabilidad" />
          </>
        )}

        {/* ─── Administración ─────────────────────────────────────────── */}
        <GroupLabel label="Administración" />
        {tienePermiso('channel_manager.gestionar') && <NavItem to="/channel-manager" icon="📡" label="Channel Manager" />}
        {esNivelAlto && <NavItem to="/notificaciones" icon="🔔" label="Notificaciones" />}
        {esNivelAlto && <NavItem to="/concierge-test" icon="🤖" label="Concierge IA test" />}
        {esNivelAlto && <NavItem to="/configuracion" icon="⚙️" label="Configuración" />}
        {tienePermiso('locales.gestionar') && <NavItem to="/locales" icon="🏨" label="Gestión de locales" />}
        {tienePermiso('personal.gestionar') && <NavItem to="/personal" icon="👥" label="Personal" />}

        {/* ─── Plataforma SaaS ────────────────────────────────────────── */}
        {esSuperadminPlataforma && (
          <>
            <GroupLabel label="Plataforma" />
            <NavItem to="/plataforma/empresas" icon="🏢" label="Empresas" highlight />
          </>
        )}
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

function GroupLabel({ label }: { label: string }) {
  return (
    <div className="pt-3 pb-1">
      <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
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
