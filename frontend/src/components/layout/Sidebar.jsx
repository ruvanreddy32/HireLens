import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const jobSeekerNav = [
  { path: '/dashboard',    label: 'Dashboard',          icon: 'grid_view' },
  { path: '/resume',       label: 'Resume Management',  icon: 'description' },
  { path: '/jobs',         label: 'Explore Jobs',       icon: 'work' },
  { path: '/applications', label: 'Applications',       icon: 'send' },
  { path: '/profile',      label: 'Profile',            icon: 'manage_accounts' },
]

const recruiterNav = [
  { path: '/recruiter/dashboard',  label: 'Dashboard',        icon: 'grid_view' },
  { path: '/recruiter/jobs',       label: 'Job Management',   icon: 'work' },
  { path: '/recruiter/candidates', label: 'Candidates',       icon: 'group' },
  { path: '/recruiter/analytics',  label: 'Analytics',        icon: 'bar_chart' },
  { path: '/profile',              label: 'Profile',          icon: 'manage_accounts' },
]

export default function Sidebar({ onClose }) {
  const { user, role, logout } = useAuthStore()
  const navigate = useNavigate()

  const navItems = role === 'recruiter' ? recruiterNav : jobSeekerNav

  const handleLogout = () => {
    logout()
    navigate('/auth/login')
  }

  return (
    <div className="w-60 flex flex-col h-full bg-surface-container-lowest border-r border-outline-variant">
      {/* Logo */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-outline-variant/80 shrink-0 bg-white/50 backdrop-blur-xs">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-blue-500 shadow-sm flex items-center justify-center">
          <span className="material-symbols-outlined text-on-primary text-[20px]">lens</span>
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-on-surface tracking-tight leading-tight text-sm">HireLens</span>
          <span className="text-[10px] text-primary font-semibold uppercase tracking-wider">
            {role === 'recruiter' ? 'Recruiter Portal' : 'Job Seeker'}
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {navItems.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-50 via-blue-50/70 to-surface-container-low text-primary font-bold shadow-subtle border border-blue-200/70'
                  : 'text-on-surface-variant hover:bg-surface-container-low/70 hover:text-on-surface'
              }`
            }
          >
            <span className="material-symbols-outlined text-[19px] shrink-0">{icon}</span>
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User snippet */}
      <div className="p-3 border-t border-outline-variant/80 shrink-0 bg-white/40">
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-container-low/70 border border-outline-variant/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shrink-0 shadow-subtle">
            <span className="text-on-primary text-xs font-bold">{user?.initials ?? '?'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-on-surface truncate leading-tight">{user?.name}</p>
            <p className="text-[10px] text-secondary truncate">{user?.title ?? user?.company}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-red-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
          </button>
        </div>
      </div>
    </div>
  )
}
