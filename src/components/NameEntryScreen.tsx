import { useEffect, useState } from 'react'
import type { GameSettings, SessionSummary } from '../game/types'
import { HumanityLine, TerminalAction, TerminalFrame, TerminalHeader } from './terminal/TerminalPrimitives'

const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

export function NameEntryScreen({ summary, settings, timeoutSeconds, onSubmit }: { summary: SessionSummary; settings: GameSettings; timeoutSeconds: number; onSubmit: (name: string) => void }) {
  const [name, setName] = useState('')
  const add = (key: string) => setName(value => `${value}${key}`.slice(0, settings.nameMaxLength))
  useEffect(() => {
    const timer = window.setTimeout(() => onSubmit('PLAYER'), timeoutSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [name, onSubmit, timeoutSeconds])
  return (
    <TerminalFrame state="records" className="name-screen">
      <TerminalHeader subjectId={summary.subjectId} status="RECORD QUALIFIED" humanity={summary.score} />
      <section className="name-registration">
        <span>SUBJECT IDENTIFIER</span>
        <h1>REGISTER RECORD</h1>
        <div className="name-display" aria-live="polite"><b>{name.padEnd(Math.max(3, settings.nameMaxLength), '_')}</b><small>{name.length}/{settings.nameMaxLength}</small></div>
        <div className="touch-keyboard" aria-label="Touch keyboard">
          {rows.map(row => <div key={row}>{[...row].map(key => <button key={key} onClick={() => add(key)}>{key}</button>)}</div>)}
          <div><button className="wide" onClick={() => add(' ')}>SPACE</button><button className="wide" onClick={() => setName(value => value.slice(0, -1))}>DELETE</button></div>
        </div>
        <div className="name-actions"><TerminalAction onClick={() => onSubmit('PLAYER')}>SKIP / USE PLAYER</TerminalAction><TerminalAction tone="verified" disabled={name.trim().length < 3} onClick={() => onSubmit(name)}>REGISTER SUBJECT</TerminalAction></div>
      </section>
      <HumanityLine value={summary.score} tone="verified" />
      <footer>IDLE RECORDS USE PLAYER AFTER {timeoutSeconds} SECONDS</footer>
    </TerminalFrame>
  )
}
