import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TurnoWidget from './turno/TurnoWidget'
import SelectorLocal from './SelectorLocal'
import ThemeToggle from './ThemeToggle'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-bg-secondary overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-5 py-2 bg-bg-header border-b border-border-primary shrink-0">
          <SelectorLocal />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <TurnoWidget />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
