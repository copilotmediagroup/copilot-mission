import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

type BoundaryState = { error: Error | null }

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Co Pilot startup failure', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="boot-recovery-screen">
          <section>
            <strong>CO PILOT</strong>
            <h1>Workspace could not start</h1>
            <p>{this.state.error.message || 'An unexpected startup error occurred.'}</p>
            <button onClick={() => window.location.reload()}>Reload workspace</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}

const root = document.getElementById('root')
if (!root) {
  document.body.innerHTML = '<main style="padding:40px;font-family:system-ui"><h1>Co Pilot startup error</h1><p>The application root element is missing.</p></main>'
  throw new Error('ROOT_ELEMENT_MISSING')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)
