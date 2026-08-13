import { useEffect, useState } from 'react'
import { gameAudio } from '../audio/audio'
import type { SessionSummary } from '../game/types'
import { HumanityDisplay, HumanityLine, MeasurementValue, TerminalAction, TerminalFrame, TerminalHeader, VerificationStamp } from './terminal/TerminalPrimitives'

interface Props { summary: SessionSummary; timeoutSeconds: number; onReplay: () => void; onLeaderboard: () => void; onHome: () => void }

export function ResultScreen({ summary, timeoutSeconds, onReplay, onLeaderboard, onHome }: Props) {
  const club99 = summary.score >= 99
  const [acceptanceStep, setAcceptanceStep] = useState(club99 ? 0 : 5)
  useEffect(() => {
    const timer = window.setTimeout(onHome, timeoutSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [timeoutSeconds, onHome])
  useEffect(() => {
    if (!club99) return
    gameAudio.silence()
    const timers = [700, 1500, 2500, 3500, 4300].map((delay, index) => window.setTimeout(() => {
      setAcceptanceStep(index + 1)
      if (index === 3) gameAudio.play('record')
    }, delay))
    return () => timers.forEach(timer => window.clearTimeout(timer))
  }, [club99])

  if (club99 && acceptanceStep < 5) {
    return <TerminalFrame state="accepted" phase="hostile" className="acceptance-screen"><section aria-live="assertive"><span>FINALIZING SUBJECT PROFILE</span><div className="acceptance-checks"><p className={acceptanceStep > 0 ? 'ready' : ''}>MOTOR RESPONSE <b>{acceptanceStep > 0 ? 'ACCEPTED' : 'PENDING'}</b></p><p className={acceptanceStep > 1 ? 'ready' : ''}>TIMING RESPONSE <b>{acceptanceStep > 1 ? 'ACCEPTED' : 'PENDING'}</b></p><p className={acceptanceStep > 2 ? 'ready' : ''}>MEMORY RESPONSE <b>{acceptanceStep > 2 ? 'ACCEPTED' : 'PENDING'}</b></p><p className={acceptanceStep > 3 ? 'ready' : ''}>ANOMALY SCAN <b>{acceptanceStep > 3 ? 'CLEAR' : 'PENDING'}</b></p></div>{acceptanceStep >= 4 && <div className="acceptance-verdict"><VerificationStamp label="SUBJECT ACCEPTED" tone="verified" /><h1>HUMANITY CONFIRMED</h1><HumanityDisplay value={summary.score} hero /><p>99 CLUB</p></div>}</section></TerminalFrame>
  }

  const failed = summary.endReason === 'tolerance-exhausted'
  return (
    <TerminalFrame state={failed ? 'failure' : 'result'} className={`result-screen ${club99 ? 'club-99' : ''}`}>
      <TerminalHeader subjectId={summary.subjectId} status={failed ? 'VERIFICATION FAILED' : 'REPORT COMPLETE'} humanity={summary.score} />
      {summary.isNewStandard && <div className="new-standard"><span>REFERENCE HUMAN UPDATED</span><b>{summary.score.toFixed(2)}%</b><small>NEW HUMAN STANDARD</small></div>}
      <section className="result-report">
        <div className="result-report__title"><span>AreUHuman REPORT</span><VerificationStamp label={failed ? 'INVALID' : 'VERIFIED'} tone={failed ? 'failure' : 'verified'} /></div>
        <div className="result-report__score"><HumanityDisplay value={summary.score} hero /><div><span>CLASSIFICATION</span><h1>{summary.category}</h1>{summary.rankToday && <p>TODAY'S RANK <b>#{summary.rankToday}</b></p>}</div></div>
        <div className="result-measurements">
          <MeasurementValue label="TESTS SURVIVED" value={String(summary.completed).padStart(2, '0')} />
          <MeasurementValue label="PRECISION" value={Math.round(summary.precision * 100)} unit="%" />
          <MeasurementValue label="BEST RESPONSE CHAIN" value={String(summary.bestCombo).padStart(2, '0')} />
          <MeasurementValue label="ERRORS" value={String(summary.failures).padStart(2, '0')} tone={summary.failures ? 'failure' : 'verified'} />
          {summary.bestTimingErrorMs !== undefined && <MeasurementValue label="BEST TIMING ERROR" value={Math.round(summary.bestTimingErrorMs)} unit="ms" />}
          <MeasurementValue label="SESSION DURATION" value={Math.round(summary.durationMs / 1000)} unit="s" />
        </div>
        {failed && <div className="failure-cause"><span>CAUSE</span><b>{summary.nearestMiss ?? 'ERROR ALLOWANCE EXHAUSTED'}</b></div>}
        {summary.prize && <div className="prize-banner"><span>DETERMINISTIC PRIZE TIER</span><b>{summary.prize.name}</b></div>}
      </section>
      <div className="result-actions"><TerminalAction tone="verified" onClick={onReplay}>VERIFY AGAIN</TerminalAction><TerminalAction onClick={onLeaderboard}>VIEW RECORDS</TerminalAction><TerminalAction onClick={onHome}>RETURN TO STANDBY</TerminalAction></div>
      <HumanityLine value={summary.score} tone={failed ? 'failure' : 'verified'} />
      <footer>AUTOMATIC STANDBY IN {timeoutSeconds} SECONDS</footer>
    </TerminalFrame>
  )
}
