import { safeReturnPath } from '../utils/workspace.ts'
import { Navigate, Outlet, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.ts'

export function PublicOnlyRoute() {
  const [params] = useSearchParams()
  const { currentUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-3xl border border-white/60 bg-white/80 px-6 py-5 text-sm font-medium text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          Checking session...
        </div>
      </div>
    )
  }

  if (currentUser) {
    if (params.get('mode') === 'register' && params.get('kind') === 'player') {
      return <Navigate replace to="/?register=player" />
    }
    return <Navigate replace to={safeReturnPath(params.get('next'))} />
  }

  return <Outlet />
}
