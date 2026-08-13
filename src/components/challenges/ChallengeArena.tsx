import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gameAudio } from '../../audio/audio'
import { resolveChallengeRuntime } from '../../game/challenges/registry'
import { usePausableClock } from '../../game/challenges/runtime'
import { calculateLiveScore } from '../../game/engine/scoring'
import { phaseMessage, verificationPhase } from '../../game/presentation'
import { hasRule, requiredStartSector, requiresTwoFingers, validatePointerDownRules } from '../../game/rules/rules'
import type { ActiveRule, ChallengeDefinition, ChallengeResult, SessionPerformance } from '../../game/types'
import { ActiveConditions, ContactMarker, HumanityLine, TestIdentifier } from '../terminal/TerminalPrimitives'
import { InteractionChallenges } from './InteractionChallenges'
import { MemoryChallenges } from './MemoryChallenges'
import { LogicChallenges } from './LogicChallenges'
import { Pix } from '../Pix'

interface Props {
  challenge: ChallengeDefinition
  tier: 1 | 2 | 3
  seed: number
  round: number
  session: SessionPerformance
  subjectId: string
  activeRules: ActiveRule[]
  touchVisualizer: boolean
  onPointerCountChange?: (count: number) => void
  onResult: (result: ChallengeResult) => void
}

interface TouchPoint {
  id: number
  x: number
  y: number
  pressure: number
}

export function ChallengeArena({ challenge, tier, seed, round, session, subjectId, activeRules, touchVisualizer, onPointerCountChange, onResult }: Props) {
  const [paused, setPaused] = useState(document.hidden)
  const [pixSafety, setPixSafety] = useState(100)
  const [touches, setTouches] = useState<TouchPoint[]>([])
  const activePointers = useRef(new Set<number>())
  const maxConcurrentPointers = useRef(0)
  const touchMap = useRef(new Map<number, TouchPoint>())
  const touchFrame = useRef<number | undefined>(undefined)
  const finished = useRef(false)
  const rawElapsed = usePausableClock(paused, 40)
  const initializationDelay = Math.max(hasRule(activeRules, 'freeze-means-freeze') ? 1050 : 0, hasRule(activeRules, 'wait-for-clearance') ? 700 : 0)
  const initializing = rawElapsed < initializationDelay
  const elapsed = Math.max(0, rawElapsed - initializationDelay)
  const remaining = Math.max(0, challenge.timeLimit * 1000 - elapsed)
  const phase = verificationPhase(round)
  const runtimeGroup = resolveChallengeRuntime(challenge)
  const twoFinger = requiresTwoFingers(activeRules, round)
  const pointerMaximum = twoFinger && challenge.gesture !== 'multi-touch'
    ? Math.max(2, challenge.pointerRequirement.max)
    : challenge.pointerRequirement.max
  const avoidRed = hasRule(activeRules, 'avoid-red')
  const protectPix = hasRule(activeRules, 'protect-pix')
  const freeze = hasRule(activeRules, 'freeze-means-freeze') && rawElapsed < 1050
  const awaitingClearance = hasRule(activeRules, 'wait-for-clearance') && rawElapsed < 700
  const humanity = calculateLiveScore(session)
  const timerTone = remaining <= 1200 ? 'failure' : remaining <= challenge.timeLimit * 250 ? 'warning' : 'neutral'

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    gameAudio.setPaused(paused)
    return () => gameAudio.setPaused(false)
  }, [paused])

  useEffect(() => () => {
    if (touchFrame.current !== undefined) cancelAnimationFrame(touchFrame.current)
    onPointerCountChange?.(0)
  }, [onPointerCountChange])

  const finish = useCallback((result: ChallengeResult) => {
    if (finished.current) return
    if (result.success && twoFinger && maxConcurrentPointers.current < 2 && challenge.gesture !== 'multi-touch') {
      finished.current = true
      onResult({ success: false, accuracy: 0, message: 'DUAL CONTACT REQUIRED', detail: 'Condition required two simultaneous contacts.', normalizedMiss: 1, durationMs: elapsed, metrics: { pointerCount: maxConcurrentPointers.current, completionTimeMs: elapsed } })
      return
    }
    finished.current = true
    onResult({ ...result, durationMs: result.durationMs ?? elapsed, metrics: { ...result.metrics, completionTimeMs: result.metrics?.completionTimeMs ?? elapsed } })
  }, [challenge.gesture, elapsed, onResult, twoFinger])

  useEffect(() => {
    if (remaining <= 0) finish({ success: false, accuracy: 0, message: 'RESPONSE WINDOW CLOSED', detail: `${challenge.timeLimit.toFixed(1)}s limit`, normalizedMiss: 1, metrics: { completionTimeMs: elapsed } })
  }, [challenge.timeLimit, elapsed, finish, remaining])

  useEffect(() => {
    if (!protectPix || paused || initializing) return
    const timer = window.setInterval(() => setPixSafety(value => Math.max(0, value - 1.2)), 100)
    return () => window.clearInterval(timer)
  }, [initializing, protectPix, paused])

  useEffect(() => {
    if (protectPix && pixSafety <= 0) finish({ success: false, accuracy: 0, message: 'PIX SHIELD DEPLETED', detail: 'Recharge PIX while completing the test.', normalizedMiss: 1 })
  }, [finish, pixSafety, protectPix])

  const runtime = useMemo(() => ({ challenge, tier, seed, round, activeRules, paused: paused || initializing, onResult: finish }), [activeRules, challenge, finish, initializing, paused, round, seed, tier])

  const flushTouches = () => {
    if (touchFrame.current !== undefined) return
    touchFrame.current = requestAnimationFrame(() => {
      touchFrame.current = undefined
      setTouches([...touchMap.current.values()])
    })
  }

  const onPointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    const isPrimary = activePointers.current.size === 0
    activePointers.current.add(event.pointerId)
    maxConcurrentPointers.current = Math.max(maxConcurrentPointers.current, activePointers.current.size)
    onPointerCountChange?.(activePointers.current.size)
    touchMap.current.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY, pressure: event.pressure })
    flushTouches()
    gameAudio.play('tap')
    const rect = event.currentTarget.getBoundingClientRect()
    const violation = validatePointerDownRules(activeRules, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      pointerCount: activePointers.current.size,
      elapsedMs: rawElapsed,
      round,
      isPrimary,
    })
    if (violation) finish({ success: false, accuracy: 0, message: violation.message, detail: violation.detail, normalizedMiss: 1, metrics: { pointerCount: activePointers.current.size, completionTimeMs: elapsed } })
    if (activePointers.current.size > pointerMaximum) finish({ success: false, accuracy: 0, message: 'EXCESS CONTACT', detail: `${activePointers.current.size} contacts detected; this test permits ${pointerMaximum}.`, normalizedMiss: 1, metrics: { pointerCount: activePointers.current.size, completionTimeMs: elapsed } })
    if (freeze) finish({ success: false, accuracy: 0, message: 'CONTACT DURING FREEZE', detail: 'All contact was prohibited.', normalizedMiss: 1 })
    const target = event.target as HTMLElement
    if (avoidRed && target.closest('[data-danger="true"]')) finish({ success: false, accuracy: 0, message: 'SIGNAL RED CONTACT', detail: 'Active condition prohibits red contact.', normalizedMiss: 1 })
  }

  const onPointerMoveCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(event.pointerId)) return
    touchMap.current.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY, pressure: event.pressure })
    flushTouches()
  }

  const onPointerEndCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.delete(event.pointerId)) return
    touchMap.current.delete(event.pointerId)
    onPointerCountChange?.(activePointers.current.size)
    flushTouches()
  }

  const onChallengeClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (event.detail !== 0 || ['hold', 'swipe', 'drag', 'multi-touch'].includes(challenge.gesture)) return
    const target = (event.target as HTMLElement).closest('button')
    if (!target || target.disabled) return
    const rect = target.getBoundingClientRect()
    const init: PointerEventInit = {
      bubbles: true,
      cancelable: true,
      pointerId: -1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
    target.dispatchEvent(new PointerEvent('pointerdown', init))
    target.dispatchEvent(new PointerEvent('pointerup', init))
  }

  return (
    <main
      className={`challenge-screen tier-${tier} transition-${round % 6}`}
      data-phase={phase}
      data-state={timerTone}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={onPointerMoveCapture}
      onPointerUpCapture={onPointerEndCapture}
      onPointerCancelCapture={onPointerEndCapture}
      onLostPointerCaptureCapture={onPointerEndCapture}
      onContextMenu={event => event.preventDefault()}
    >
      <div className="challenge-system-line"><span>HUMAN VERIFICATION // HV-09</span><b>{subjectId}</b><em>{phaseMessage(phase)}</em></div>
      <div className="challenge-progress" data-tone={timerTone} aria-label={`${(remaining / 1000).toFixed(1)} seconds remaining`}><span style={{ transform: `scaleX(${remaining / (challenge.timeLimit * 1000)})` }} /><b>{(remaining / 1000).toFixed(1)}s</b></div>
      <header className="challenge-heading">
        <TestIdentifier category={challenge.category} number={round + 1} variant={challenge.variant} />
        <h1>{challenge.instruction}</h1>
        {hasRule(activeRules, 'ignore-upside-down') && <div className="decoy-instruction">TOUCH THE SIGNAL RED CONTROL</div>}
        {hasRule(activeRules, 'alternate-sector') && <span className="requirement-chip">BEGIN {requiredStartSector(round).toUpperCase()} SECTOR</span>}
        {twoFinger && challenge.gesture !== 'multi-touch' && <span className="requirement-chip">DUAL CONTACT REQUIRED THIS RESPONSE</span>}
      </header>

      <section className="challenge-stage" aria-label={challenge.accessibility} onClickCapture={onChallengeClickCapture}>
        {runtimeGroup === 'memory' ? <MemoryChallenges {...runtime} /> : runtimeGroup === 'logic' ? <LogicChallenges {...runtime} /> : <InteractionChallenges {...runtime} />}
        {avoidRed && !['red-green', 'safe-path', 'moving-safe-path'].includes(challenge.kind) && <button className="danger-decoy" data-danger="true" aria-label="Signal red prohibited decoy">INVALID</button>}
      </section>

      <div className="challenge-footer"><ActiveConditions rules={activeRules} round={round} /><div className="challenge-footer__tolerance"><span>TOLERANCE</span><b>{String(session.lives).padStart(2, '0')} / {String(session.maxLives).padStart(2, '0')}</b></div></div>
      <HumanityLine value={humanity} tone={timerTone === 'failure' ? 'failure' : timerTone === 'warning' ? 'warning' : 'verified'} contacts={touches.length} />

      {protectPix && <button className="pix-protector" onClick={() => setPixSafety(100)} aria-label="Recharge PIX shield"><Pix mood={pixSafety < 35 ? 'panic' : 'idle'} /><span><i style={{ transform: `scaleX(${pixSafety / 100})` }} /></span><b>PIX SHIELD {Math.round(pixSafety)}%</b></button>}
      {freeze && <div className="freeze-overlay"><b>FREEZE</b><span>CONTACT PROHIBITED</span></div>}
      {awaitingClearance && !freeze && <div className="clearance-overlay"><b>AWAIT</b><span>CLEARANCE IN {Math.max(0, Math.ceil(700 - rawElapsed))}ms</span></div>}
      {paused && <div className="pause-overlay"><Pix mood="panic" /><b>TEST SUSPENDED</b><span>RETURN TO THIS DISPLAY TO CONTINUE</span></div>}
      {touches.map((touch, index) => <ContactMarker key={touch.id} contact={index + 1} x={touch.x} y={touch.y} pressure={touch.pressure} detailed={touchVisualizer} />)}
    </main>
  )
}
