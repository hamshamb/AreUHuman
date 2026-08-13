import { useEffect, useMemo, useRef, useState } from 'react'
import { gameAudio } from '../../audio/audio'
import { failure, success, usePausableClock, type RuntimeProps } from '../../game/challenges/runtime'
import { hashSeed, mulberry32 } from '../../game/rng'
import { Pix } from '../Pix'

const tiles = ['▲', '●', '■', '◆']

export function MemoryChallenges({ challenge, tier, seed, round, activeRules, paused, onResult }: RuntimeProps) {
  const elapsed = usePausableClock(paused, 30)
  const model = useMemo(() => {
    const random = mulberry32(hashSeed(seed, round, challenge.id.length))
    const sequenceLength = Math.round(tier === 1 ? challenge.tuning?.sequenceLength?.easy ?? 3 : tier === 2 ? challenge.tuning?.sequenceLength?.medium ?? 4 : challenge.tuning?.sequenceLength?.hard ?? 5)
    const sequence = Array.from({ length: sequenceLength }, () => Math.floor(random() * 4))
    const flashCount = 3 + Math.floor(random() * (2 + tier))
    const position = Math.floor(random() * 9)
    const firstShape = Math.floor(random() * tiles.length)
    let secondShape = Math.floor(random() * tiles.length)
    if (secondShape === firstShape) secondShape = (secondShape + 1) % tiles.length
    const rhythm = tier === 1 ? [420, 650, 420] : tier === 2 ? [320, 610, 260, 520] : [260, 480, 220, 390, 260]
    const trackPositions = [1]
    for (let index = 0; index < 5 + tier; index += 1) {
      const direction = random() > 0.5 ? 1 : -1
      trackPositions.push((trackPositions.at(-1)! + direction + 3) % 3)
    }
    return { sequence, flashCount, position, firstShape, secondShape, rhythm, trackPositions }
  }, [challenge.id, challenge.tuning?.sequenceLength, round, seed, tier])
  const [progress, setProgress] = useState(0)
  const tapTimes = useRef<number[]>([])
  const lastCue = useRef(-1)
  const memoryValue = activeRules.find(rule => rule.id === 'remember-star')?.memoryValue ?? (4 + (seed % 5))

  const sequenceInterval = tier === 3 ? 470 : 600
  const sequenceIndex = Math.floor((elapsed - 450) / sequenceInterval)
  const sequenceShowing = elapsed >= 450 && sequenceIndex >= 0 && sequenceIndex < model.sequence.length
  const sequenceActive = sequenceShowing && (elapsed - 450) % sequenceInterval < 280 ? model.sequence[sequenceIndex] : undefined
  const sequenceReady = elapsed >= 450 + model.sequence.length * sequenceInterval + 350

  const rhythmCueTimes = useMemo(() => model.rhythm.reduce<{ total: number; times: number[] }>((state, gap) => {
    const total = state.total + gap
    return { total, times: [...state.times, total] }
  }, { total: 450, times: [] }).times, [model.rhythm])
  const rhythmCueIndex = rhythmCueTimes.findIndex(time => elapsed >= time && elapsed < time + 130)
  const rhythmReady = elapsed >= (rhythmCueTimes.at(-1) ?? 0) + 450

  const flashTarget = challenge.kind === 'after-flashes' ? 4 : model.flashCount
  const flashInterval = tier === 3 ? 390 : 520
  const flashIndex = Math.min(flashTarget, Math.floor(elapsed / flashInterval))
  const flashActive = flashIndex < flashTarget && elapsed % flashInterval < 170
  const flashReadyAt = flashTarget * flashInterval + (challenge.kind === 'after-flashes' ? 260 : 500)
  const flashReady = flashIndex >= flashTarget && elapsed >= flashReadyAt
  const afterFlashWindow = [700, 520, 380][tier - 1] ?? 520

  const trackMove = Math.max(0, Math.min(model.trackPositions.length - 1, Math.floor((elapsed - 900) / 380) + 1))
  const trackPhase = elapsed < 900 ? 0 : elapsed < 900 + (model.trackPositions.length - 1) * 380 + 350 ? 1 : 2
  const correctCup = model.trackPositions[trackMove]!

  useEffect(() => {
    let cue = -1
    if ((challenge.kind === 'memory-sequence' || challenge.kind === 'reverse-memory') && sequenceActive !== undefined) cue = sequenceIndex
    if (challenge.kind === 'rhythm-copy' && rhythmCueIndex >= 0) cue = rhythmCueIndex
    if ((challenge.kind === 'count-flashes' || challenge.kind === 'after-flashes') && flashActive) cue = flashIndex
    if (cue >= 0 && cue !== lastCue.current) {
      lastCue.current = cue
      gameAudio.play(challenge.kind === 'rhythm-copy' ? 'count' : 'tap')
    }
  }, [challenge.kind, flashActive, flashIndex, rhythmCueIndex, sequenceActive, sequenceIndex])

  useEffect(() => {
    if (challenge.kind === 'after-flashes' && elapsed > flashReadyAt + afterFlashWindow) {
      onResult(failure('RESPONSE WINDOW CLOSED', `${Math.round(elapsed - flashReadyAt)}ms after signal 04`, elapsed - flashReadyAt, { timingErrorMs: elapsed - flashReadyAt, sequenceLength: 4, completionTimeMs: elapsed }))
    }
  }, [afterFlashWindow, challenge.kind, elapsed, flashReadyAt, onResult])

  const tapSequence = (index: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!sequenceReady) { onResult(failure('CAPTURE IN PROGRESS', 'Wait until the sequence finishes.')); return }
    const expected = challenge.kind === 'reverse-memory' ? [...model.sequence].reverse() : model.sequence
    if (index !== expected[progress]) onResult(failure('SEQUENCE INVALID', `Step ${progress + 1} required ${tiles[expected[progress]!]}.`, undefined, { sequenceLength: progress }))
    else if (progress + 1 === expected.length) onResult(success('SEQUENCE VERIFIED', 0.96, `${expected.length} correct responses`, expected.length, { sequenceLength: expected.length, completionTimeMs: elapsed }))
    else setProgress(value => value + 1)
  }

  const numberPad = (correct: number) => <div className="number-pad">{Array.from({ length: 9 }, (_, index) => index + 1).map(number => <button key={number} onPointerDown={() => onResult(number === correct ? success('MEMORY VERIFIED', 0.95, `Stored number ${correct}`, correct, { completionTimeMs: elapsed }) : failure('MEMORY MISMATCH', `Measured ${number}; stored number ${correct}.`))}>{number}</button>)}</div>

  if (challenge.kind === 'memory-sequence' || challenge.kind === 'reverse-memory') {
    return <div className="memory-board"><p>{sequenceReady ? challenge.kind === 'reverse-memory' ? 'REPRODUCE / REVERSE' : 'REPRODUCE' : 'CAPTURE'} <span>{sequenceReady ? `${progress}/${model.sequence.length}` : `${Math.max(0, sequenceIndex + 1)}/${model.sequence.length}`}</span></p><div className="memory-grid">{tiles.map((tile, index) => <button key={tile} className={sequenceActive === index ? 'active' : ''} onPointerDown={tapSequence(index)} aria-pressed={progress > 0}>{tile}<small>CELL_{index + 1}</small></button>)}</div></div>
  }

  if (challenge.kind === 'delayed-memory') return elapsed < 900 ? <div className="star-memory"><b>{memoryValue}</b><small>CONTROL NUMBER / RETAIN</small></div> : numberPad(memoryValue)

  if (challenge.kind === 'track-target') {
    return <div className={`track-board phase-${trackPhase}`}><p>{trackPhase === 0 ? 'PIX IDENTIFIED' : trackPhase === 1 ? 'TRACKING ACTIVE' : 'SELECT PIX CHAMBER'}</p><div className="cups">{[0, 1, 2].map(index => <button key={index} className={correctCup === index && trackPhase < 2 ? 'marked' : ''} onPointerDown={() => {
      if (trackPhase < 2) onResult(failure('SELECTION PREMATURE', 'Wait for tracking to finish.'))
      else onResult(index === correctCup ? success('TRACKING VERIFIED', 0.96, `Chamber ${index + 1}`, index + 1, { completionTimeMs: elapsed }) : failure('TRACK LOST', `PIX was in chamber ${correctCup + 1}.`))
    }}>{correctCup === index && trackPhase === 0 ? <Pix /> : <span />}</button>)}</div></div>
  }

  if (challenge.kind === 'rhythm-copy') {
    const tap = () => {
      if (!rhythmReady) { onResult(failure('PULSE CAPTURE ACTIVE', 'Listen before reproducing the signal.')); return }
      tapTimes.current.push(performance.now())
      setProgress(tapTimes.current.length)
      if (tapTimes.current.length === model.rhythm.length) {
        const userGaps = tapTimes.current.slice(1).map((time, index) => time - tapTimes.current[index]!)
        const expected = model.rhythm.slice(1)
        const averageError = expected.reduce((sum, gap, index) => sum + Math.abs(gap - (userGaps[index] ?? 0)), 0) / expected.length
        const tolerance = tier === 3 ? 150 : 220
        const metrics = { timingErrorMs: averageError, sequenceLength: expected.length + 1, completionTimeMs: elapsed }
        if (averageError <= tolerance) onResult(success(averageError < 60 ? 'PRECISE RHYTHM' : 'RHYTHM VERIFIED', 1 - averageError / tolerance, `${Math.round(averageError)}ms mean error`, averageError, metrics))
        else onResult(failure('RHYTHM MISMATCH', `${Math.round(averageError)}ms mean error`, averageError, metrics, averageError / tolerance))
      }
    }
    return <button className={`rhythm-pad ${rhythmCueIndex >= 0 ? 'active' : ''}`} onPointerDown={tap}><b>{rhythmReady ? 'REPRODUCE' : 'CAPTURE'}</b><span>{rhythmReady ? `${progress}/${model.rhythm.length}` : '·'.repeat(model.rhythm.length)}</span></button>
  }

  if (challenge.kind === 'count-flashes') return !flashReady ? <div className={`flash-counter ${flashActive ? 'active' : ''}`}><span /><b>COUNT / DO NOT RESPOND</b></div> : numberPad(model.flashCount)

  if (challenge.kind === 'after-flashes') return <button className={`after-flash ${flashActive ? 'active' : ''}`} onPointerDown={() => {
    const responseDelay = elapsed - flashReadyAt
    if (flashReady && flashIndex === 4 && responseDelay <= afterFlashWindow) onResult(success('COUNTED RESPONSE VERIFIED', 1 - responseDelay / afterFlashWindow, `${Math.round(responseDelay)}ms after signal 04`, responseDelay, { timingErrorMs: responseDelay, sequenceLength: 4, completionTimeMs: elapsed }))
    else onResult(failure('COUNTED RESPONSE INVALID', `Contact after signal ${flashIndex}.`))
  }}><span>{flashReady ? 'RESPOND' : 'CAPTURE'}</span><small>{String(flashIndex).padStart(2, '0')} SIGNALS</small></button>

  if (challenge.kind === 'previous-shape') {
    const displayPhase = elapsed < 900 ? 0 : elapsed < 1650 ? 1 : 2
    if (displayPhase < 2) return <div className="shape-show"><b>{tiles[displayPhase === 0 ? model.firstShape : model.secondShape]}</b><span>{displayPhase === 0 ? 'SAMPLE_01' : 'SAMPLE_02'}</span></div>
    return <div className="shape-options">{tiles.map((tile, index) => <button key={tile} onPointerDown={() => onResult(index === model.firstShape ? success('PREVIOUS SAMPLE VERIFIED', 0.98, tile, index, { completionTimeMs: elapsed }) : failure('SAMPLE MISMATCH', `Previous sample was ${tiles[model.firstShape]}.`))}>{tile}</button>)}</div>
  }

  if (challenge.kind === 'disappearing-position') {
    const displayPhase = elapsed < 900 ? 0 : elapsed < 1650 ? 1 : 2
    return <div className="position-memory"><p>{displayPhase === 0 ? 'CAPTURE COORDINATE' : displayPhase === 1 ? 'RETAIN' : 'SELECT COORDINATE'}</p><div>{Array.from({ length: 9 }, (_, index) => <button key={index} className={displayPhase === 0 && index === model.position ? 'marked' : ''} onPointerDown={() => {
      if (displayPhase < 2) onResult(failure('SELECTION PREMATURE', 'Wait for the marker to clear.'))
      else onResult(index === model.position ? success('COORDINATE VERIFIED', 1, `Cell ${index + 1}`, index + 1, { completionTimeMs: elapsed }) : failure('COORDINATE MISMATCH', `Stored coordinate was cell ${model.position + 1}.`))
    }} aria-label={`Cell ${index + 1}`} />)}</div></div>
  }

  return <div className="challenge-error">UNREGISTERED MEMORY TEST // {challenge.name}</div>
}
