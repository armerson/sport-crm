import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { reloadWhenAppUpdates } from './registerAppUpdates.ts'
import { AppErrorBoundary } from './components/ui/AppErrorBoundary.tsx'
import { installClientErrorMonitoring } from './services/clientErrorMonitoring.ts'

reloadWhenAppUpdates()
installClientErrorMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
