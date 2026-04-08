import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './router/ProtectedRoute.tsx'
import { PublicOnlyRoute } from './router/PublicOnlyRoute.tsx'

const AuthPage = lazy(async () => {
  const module = await import('./pages/AuthPage.tsx')
  return { default: module.AuthPage }
})

const DashboardPage = lazy(async () => {
  const module = await import('./pages/DashboardPage.tsx')
  return { default: module.DashboardPage }
})

const RegisterPage = lazy(async () => {
  const module = await import('./pages/RegisterPage.tsx')
  return { default: module.RegisterPage }
})

const JoinPage = lazy(async () => {
  const module = await import('./pages/JoinPage.tsx')
  return { default: module.JoinPage }
})

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="rounded-3xl border border-white/60 bg-white/80 px-6 py-5 text-sm font-medium text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
        Loading workspace...
      </div>
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<AuthPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
        </Route>
        {/* Public registration forms — no auth required */}
        <Route path="/register/:slug" element={<RegisterPage />} />
        {/* Team invite links — public, anyone can land here */}
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
