import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.ts'

export function ProtectedRoute() {
  const location = useLocation()
  const { currentUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-3xl border border-white/60 bg-white/80 px-6 py-5 text-sm font-medium text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          Loading club workspace...
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate replace to={`/login?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`} />
  }

  return <Outlet />
}