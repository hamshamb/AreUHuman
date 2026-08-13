import { useEffect, useState } from 'react'
import { gameAudio } from '../audio/audio'
import { CalibrationCross, HumanityLine, TerminalFrame, TerminalHeader } from './terminal/TerminalPrimitives'

export function ReadyScreen({ lives, subjectId, onComplete }: { lives: number; subjectId: string; onComplete: () => void }) {
  const [step, setStep] = useState(-1)
  useEffect(() => {
    const intro = window.setTimeout(() => setStep(3), 480)
    return () => window.clearTimeout(intro)
  }, [])
  useEffect(() => {
    if (step < 0) return
    gameAudio.play(step === 0 ? 'start' : 'count')
    if (step === 0) {
      const done = window.setTimeout(onComplete, 380)
      return () => window.clearTimeout(done)
    }
    const timer = window.setTimeout(() => setStep(value => value - 1), 360)
    return () => window.clearTimeout(timer)
  }, [step, onComplete])
  return (
    <TerminalFrame state="initializing" className="ready-screen">
      <TerminalHeader subjectId={subjectId} status="INITIALIZING" humanity={0} />
      {step < 0 ? <section className="subject-detected"><CalibrationCross label="CONTACT_01" /><span>SUBJECT DETECTED</span><h1>{subjectId}</h1><div><p>TOUCH ARRAY <b>READY</b></p><p>ERROR ALLOWANCE <b>{String(lives).padStart(2, '0')}</b></p><p>HUMAN STATUS <b>UNKNOWN</b></p></div></section> : <section className="countdown-display" aria-live="assertive"><span>VERIFICATION BEGINS IN</span><strong key={step}>{step || 'VERIFY'}</strong></section>}
      <HumanityLine tone="information" contacts={step < 0 ? 1 : 0} />
    </TerminalFrame>
  )
}
