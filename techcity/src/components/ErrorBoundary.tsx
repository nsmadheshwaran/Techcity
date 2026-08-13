import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** Catches render-time crashes so the owner never sees a blank white screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-50 p-6">
        <div className="card max-w-md p-6 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertTriangle size={22} />
          </span>
          <h1 className="text-base font-semibold text-ink-900">The application hit an error</h1>
          <p className="mt-2 text-sm text-ink-600">
            Your saved data is safe. Reload the page to continue. If this keeps happening, export a
            backup from Settings and report the message below.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-ink-100 p-3 text-left text-[11px] text-ink-700">
            {this.state.error.message}
          </pre>
          <button className="btn-primary mt-5 w-full" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Reload application
          </button>
        </div>
      </div>
    )
  }
}
