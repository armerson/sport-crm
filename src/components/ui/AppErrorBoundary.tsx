import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportClientError } from '../../services/clientErrorMonitoring.ts'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const diagnostic = new Error(error.message)
    diagnostic.name = error.name
    diagnostic.stack = `${error.stack ?? ''}\nComponent stack:${info.componentStack ?? ''}`
    void reportClientError({ error: diagnostic, source: 'react.error-boundary' })
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="flex min-h-dvh items-center justify-center bg-[var(--ui-canvas)] px-5">
        <section className="ui-panel w-full max-w-md p-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ui-accent)]">ClubOS</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-950">This screen could not be displayed</h1>
          <p className="mt-2 text-sm text-slate-600">The issue has been recorded. Reload ClubOS to try again.</p>
          <button className="ui-button ui-button-primary mt-5 w-full" type="button" onClick={() => window.location.reload()}>
            Reload ClubOS
          </button>
        </section>
      </main>
    )
  }
}

