import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TurnoWidget from './turno/TurnoWidget'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-end px-5 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          <TurnoWidget />
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
