import { useEffect, useState } from 'react'
import { CalibrationCross, TerminalFrame, TerminalHeader } from './terminal/TerminalPrimitives'

const checks = ['DISPLAY', 'TOUCH ARRAY', 'AUDIO BUS', 'LOCAL STORAGE']

export function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [ready, setReady] = useState(0)
  useEffect(() => {
    const timers = checks.map((_, index) => window.setTimeout(() => setReady(index + 1), 130 + index * 150))
    timers.push(window.setTimeout(onComplete, 1050))
    return () => timers.forEach(timer => window.clearTimeout(timer))
  }, [onComplete])
  return (
    <TerminalFrame state="boot" className="boot-screen">
      <TerminalHeader status="SYSTEM BOOT" />
      <section className="boot-sequence" aria-live="polite">
        <CalibrationCross label="HV-09" />
        <div><span>INITIALIZATION SEQUENCE</span><h1>VERIFYING TERMINAL</h1></div>
        <ol>{checks.map((check, index) => <li key={check}><b>{check}</b><i /> <span>{ready > index ? 'READY' : 'CHECKING'}</span></li>)}</ol>
        <p>HUMAN STATUS <b>UNKNOWN</b></p>
      </section>
    </TerminalFrame>
  )
}
