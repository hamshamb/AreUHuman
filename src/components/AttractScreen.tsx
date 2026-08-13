import { useEffect, useRef, useState } from 'react'
import type { GameSettings, LeaderboardEntry } from '../game/types'
import { sortLeaderboard, todayEntries } from '../storage/store'
import { Pix } from './Pix'
import { CalibrationCross, HumanityLine, TerminalAction, TerminalFrame, TerminalHeader } from './terminal/TerminalPrimitives'

interface Props {
  settings: GameSettings
  leaderboard: LeaderboardEntry[]
  averageDurationMs?: number
  onStart: () => void
  onLeaderboard: () => void
  onAdmin: () => void
  onFullscreen: () => void
}

export function AttractScreen({ settings, leaderboard, averageDurationMs, onStart, onLeaderboard, onAdmin, onFullscreen }: Props) {
  const [adminHolding, setAdminHolding] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [contactDetected, setContactDetected] = useState(false)
  const adminTimer = useRef<number | undefined>(undefined)
  const startTimer = useRef<number | undefined>(undefined)
  const today = sortLeaderboard(todayEntries(leaderboard))
  const best = today[0]
  const canPlay = settings.gameEnabled && (settings.freePlay || settings.credits > 0)
  const status = !settings.gameEnabled ? 'SERVICE SUSPENDED' : !canPlay ? 'TOKEN REQUIRED' : contactDetected ? 'CONTACT DETECTED' : 'AWAITING SUBJECT'

  useEffect(() => () => {
    window.clearTimeout(adminTimer.current)
    window.clearTimeout(startTimer.current)
  }, [])

  const beginAdminHold = () => {
    if (adminTimer.current !== undefined) return
    setAdminHolding(true)
    adminTimer.current = window.setTimeout(() => { adminTimer.current = undefined; setAdminHolding(false); onAdmin() }, 4000)
  }
  const endAdminHold = () => { setAdminHolding(false); window.clearTimeout(adminTimer.current); adminTimer.current = undefined }

  const beginScan = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canPlay) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setScanning(true)
    setContactDetected(true)
    startTimer.current = window.setTimeout(onStart, 850)
  }
  const cancelScan = () => {
    window.clearTimeout(startTimer.current)
    setScanning(false)
    setContactDetected(false)
  }

  return (
    <TerminalFrame state={canPlay ? 'standby' : 'warning'} className="attract-screen">
      <TerminalHeader status={status} humanity={best?.score ?? 0} />
      <section className="attract-identity">
        <button className={`brand-lockup ${adminHolding ? 'is-holding' : ''}`} onPointerDown={beginAdminHold} onPointerUp={endAdminHold} onPointerCancel={endAdminHold} onPointerLeave={endAdminHold} onKeyDown={event => { if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); beginAdminHold() } }} onKeyUp={event => { if (event.key === 'Enter' || event.key === ' ') endAdminHold() }} aria-label={`${settings.title}. Hold for operator access.`}>
          <span>INSTITUTIONAL HUMAN VERIFICATION</span>
          <h1>{settings.title}</h1>
          <i />
        </button>
        <p>{settings.tagline}</p>
        <div className="standby-copy"><span>CURRENT HUMAN STANDARD</span><b>{best ? `${best.score.toFixed(2)}%` : 'UNSET'}</b><small>{best ? `${best.name} / ${best.challenges} TESTS` : 'NO VERIFIED SUBJECTS TODAY'}</small></div>
      </section>

      <section className="subject-scan">
        <div className="subject-scan__label"><span>SUBJECT INTAKE</span><b>{canPlay ? 'PLACE HAND' : status}</b></div>
        <button className={scanning ? 'is-scanning' : ''} disabled={!canPlay} onPointerDown={beginScan} onPointerUp={cancelScan} onPointerCancel={cancelScan} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && canPlay) onStart() }} aria-label="Place and hold a hand to begin verification">
          <CalibrationCross label={scanning ? 'CONTACT_01' : 'TOUCH FIELD'} />
          <span>{scanning ? 'ANALYZING CONTACT' : canPlay ? 'PLACE HAND ON SENSOR' : status}</span>
          <small>{scanning ? 'HOLD POSITION' : canPlay ? 'HOLD TO INITIALIZE' : settings.freePlay ? 'OPERATOR ACTION REQUIRED' : `${settings.credits} ATTEMPTS AVAILABLE`}</small>
          <i />
        </button>
      </section>

      <aside className="standby-records">
        <div><span>VERIFIED SUBJECTS / TODAY</span><b>{today.length.toString().padStart(2, '0')}</b></div>
        <div><span>AVERAGE SURVIVAL</span><b>{averageDurationMs ? `${Math.round(averageDurationMs / 1000)}s` : '--'}</b></div>
        <TerminalAction onClick={onLeaderboard}>VIEW RECORDS</TerminalAction>
      </aside>

      <div className="pix-attract"><Pix mood="idle" /><span>UNAUTHORIZED PROCESS / PIX</span></div>
      <HumanityLine value={best?.score ?? 0} tone={canPlay ? 'verified' : 'warning'} />
      <footer><span>{settings.freePlay ? 'FREE VERIFICATION' : settings.tokenPriceText}</span><b>{settings.smallCopy}</b><TerminalAction onClick={onFullscreen} aria-label="Enter fullscreen display mode">DISPLAY MODE</TerminalAction></footer>
    </TerminalFrame>
  )
}
