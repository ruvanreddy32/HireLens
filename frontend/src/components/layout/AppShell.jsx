import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileDrawer from './MobileDrawer'

export default function AppShell() {
  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Desktop sidebar — fixed left, visible on lg+ */}
      <div className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 lg:z-30">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <MobileDrawer />

      {/* Main content area — offset by sidebar on desktop */}
      <div className="flex flex-col flex-1 lg:pl-60 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
