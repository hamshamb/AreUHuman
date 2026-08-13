import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/tokens.css'
import './styles/index.css'
import './styles/screens.css'
import './styles/challenges.css'
import './styles/admin.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element was not found')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary onRecover={() => window.location.assign('/')}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
