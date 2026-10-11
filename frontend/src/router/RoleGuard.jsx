import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

/**
 * RoleGuard — enforces authentication and role-based access
 *
 * Props:
 *   requiredRole {string|null}  'job_seeker' | 'recruiter' | null (any authenticated)
 */
export default function RoleGuard({ requiredRole = null }) {
  const { isAuthenticated, role, loading } = useAuthStore()
  const hasToken = Boolean(localStorage.getItem('hirelens_token'))

  // Show loading spinner while restoring JWT session or verifying credentials
  if (loading || (!isAuthenticated && hasToken)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated && !hasToken) {
    return <Navigate to="/auth/login" replace />
  }

  if (requiredRole && role && role !== requiredRole) {
    // Redirect to the correct home for the user's actual role
    return <Navigate to={role === 'recruiter' ? '/recruiter/dashboard' : '/dashboard'} replace />
  }

  return <Outlet />
}
