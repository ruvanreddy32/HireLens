import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'

export default function Header() {
  const { pageTitle, toggleSidebar } = useUIStore()
  const { user } = useAuthStore()

  return (
    <header className="h-14 px-6 flex items-center justify-between border-b border-outline-variant/70 bg-white/85 backdrop-blur-md shrink-0 sticky top-0 z-20 shadow-subtle">
      {/* Left — mobile hamburger + page title */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger — hidden on lg */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-low transition-colors"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>

        {/* Page title */}
        <div className="flex items-center gap-2.5">
          <h1 className="text-sm font-bold text-on-surface tracking-tight">
            {pageTitle || 'HireLens'}
          </h1>
        </div>
      </div>

      {/* Right — live status indicator + avatar */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low/80 border border-outline-variant/60 text-[11px] font-semibold text-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Workspace Active</span>
        </div>

        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-subtle">
          <span className="text-on-primary text-xs font-bold">{user?.initials ?? '?'}</span>
        </div>
      </div>
    </header>
  )
}
