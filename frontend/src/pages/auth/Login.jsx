import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function Login() {
  const [selectedRole, setSelectedRole] = useState('recruiter')
  const [email, setEmail] = useState('alex.morgan@acmecorp.com')
  const [password, setPassword] = useState('password123')
  const { login, loading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  const handleRoleChange = (role) => {
    setSelectedRole(role)
    clearError()
    if (role === 'recruiter') {
      setEmail('alex.morgan@acmecorp.com')
      setPassword('password123')
    } else {
      setEmail('elena.rostova@design.io')
      setPassword('password123')
    }
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    clearError()

    const result = await login({ email, password })
    if (result.type.endsWith('/fulfilled')) {
      const userRole = result.payload.user.role.toLowerCase()
      navigate(userRole === 'recruiter' ? '/recruiter/dashboard' : '/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-[28px]">lens</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-on-surface">HireLens</h1>
            <p className="text-sm text-on-surface-variant mt-1">AI-powered recruitment intelligence</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant p-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">Sign in</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">Live PostgreSQL Backend Auth</p>
          </div>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { role: 'recruiter',  label: 'Recruiter',   icon: 'group',          desc: 'Discover & evaluate talent' },
              { role: 'job_seeker', label: 'Job Seeker',  icon: 'person_search', desc: 'Find your next role' },
            ].map(({ role, label, icon, desc }) => (
              <button
                key={role}
                type="button"
                onClick={() => handleRoleChange(role)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  selectedRole === role
                    ? 'border-primary bg-surface-container-low'
                    : 'border-outline-variant hover:border-primary/40 hover:bg-surface-container-low'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedRole === role ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-[22px]">{icon}</span>
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${selectedRole === role ? 'text-primary' : 'text-on-surface'}`}>{label}</p>
                  <p className="text-[11px] text-on-surface-variant">{desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-on-surface-variant">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg py-2.5 px-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-on-surface-variant">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg py-2.5 px-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-on-primary font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to Backend...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  <span>Sign In as {selectedRole === 'job_seeker' ? 'Job Seeker' : 'Recruiter'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-on-surface-variant">
          Live NestJS API: <code className="bg-surface-container px-1 py-0.5 rounded font-mono">http://localhost:3000</code>
        </p>
      </div>
    </div>
  )
}
