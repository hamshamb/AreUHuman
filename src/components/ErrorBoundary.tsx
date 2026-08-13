import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode; onRecover: () => void }
interface State { error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('HUMAN VERIFICATION recovery boundary', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="recovery-screen">
        <span>HV-09 // ACTIVE TEST ISOLATED</span>
        <h1>SYSTEM HALT</h1>
        <p>The interrupted subject session was safely terminated. No input state will carry into the next verification.</p>
        <button onClick={() => { this.setState({ error: undefined }); this.props.onRecover() }}>RETURN TO STANDBY</button>
        <details><summary>Diagnostic</summary><code>{this.state.error.message}</code></details>
      </main>
    )
  }
}
