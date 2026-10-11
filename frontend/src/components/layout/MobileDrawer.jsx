import { useEffect } from 'react'
import { useUIStore } from '../../store/uiStore'
import Sidebar from './Sidebar'

export default function MobileDrawer() {
  const { sidebarOpen, setSidebarOpen } = useUIStore()

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setSidebarOpen])

  if (!sidebarOpen) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-inverse-surface/50"
        onClick={() => setSidebarOpen(false)}
      />
      {/* Drawer panel */}
      <div className="absolute left-0 top-0 h-full w-60 shadow-xl">
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>
    </div>
  )
}
