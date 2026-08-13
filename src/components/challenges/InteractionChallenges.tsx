import { useEffect, useMemo, useRef, useState } from 'react'
import { distance, segmentIntersectsRect, swipeDirection, traceCoverage, type Point } from '../../game/engine/input'
import { failure, success, tierValue, usePausableClock, type RuntimeProps } from '../../game/challenges/runtime'
import { hashSeed, mulberry32 } from '../../game/rng'
import { hasRule } from '../../game/rules/rules'
import { Pix } from '../Pix'

function action<T extends HTMLElement>(handler: (event: React.PointerEvent<T>) => void) {
  return (event: React.PointerEvent<T>) => {
    event.preventDefault()
    handler(event)
  }
}

function angleDifference(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180)
}

function pointToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)) : 0
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t })
}

const TRACE_GUIDE_POINTS = Array.from({ length: 65 }, (_, index) => {
  const x = index / 64
  return `${x * 1000},${300 * (0.5 + Math.sin(x * Math.PI * 2) * 0.18)}`
}).join(' ')

export function InteractionChallenges(props: RuntimeProps) {
  const { challenge, tier, seed, activeRules, paused, onResult } = props
  const elapsed = usePausableClock(paused)
  const random = useMemo(() => mulberry32(hashSeed(seed, challenge.id.length, props.round)), [seed, challenge.id, props.round])
  const [phase, setPhase] = useState(0)
  const [progress, setProgress] = useState(0)
  const [holdStartElapsed, setHoldStartElapsed] = useState(0)
  const [position, setPositionState] = useState({ x: 14, y: 50 })
  const [runaway, setRunaway] = useState({ x: 50, y: 50, escapes: 0 })
  const [stops, setStops] = useState<number[]>([])
  const [scratchProgress, setScratchProgress] = useState(0)
  const [drawPath, setDrawPath] = useState('')
  const pointerStarts = useRef(new Map<number, { point: Point; time: number }>())
  const held = useRef(new Set<number>())
  const heldTargets = useRef(new Map<string, number>())
  const simultaneousContacts = useRef(new Map<number, { target: number; time: number }>())
  const tracePoints = useRef<Point[]>([])
  const traceArea = useRef<HTMLDivElement>(null)
  const dragArea = useRef<HTMLDivElement>(null)
  const dragGoal = useRef<HTMLSpanElement>(null)
  const staticHazard = useRef<HTMLElement>(null)
  const movingHazard = useRef<HTMLElement>(null)
  const gestureSteps = useRef<string[]>([])
  const firstHold = useRef<number | undefined>(undefined)
  const replacementOverlap = useRef(false)
  const dragPosition = useRef(position)
  const lastDragPoint = useRef<Point | undefined>(undefined)
  const scratchCanvas = useRef<HTMLCanvasElement>(null)
  const scratchBins = useRef(new Set<string>())
  const scratchLastPoint = useRef<Point | undefined>(undefined)
  const drawPoints = useRef<Point[]>([])
  const threeHoldStarted = useRef<number | undefined>(undefined)
  const opposite = hasRule(activeRules, 'opposite-day')

  const setPosition = (next: Point) => {
    dragPosition.current = next
    setPositionState(next)
  }

  useEffect(() => {
    if (challenge.kind !== 'do-nothing') return
    const duration = 2800 + tier * 420
    if (elapsed >= duration) onResult(success('INHIBITION VERIFIED', 1, `${(duration / 1000).toFixed(1)}s without contact`, duration, { completionTimeMs: duration }))
  }, [challenge.kind, elapsed, tier, onResult])

  useEffect(() => {
    if (challenge.kind === 'shrinking-target' && elapsed > 4300 - tier * 250) {
      onResult(failure('RESPONSE WINDOW CLOSED', 'The sensor reached zero size.', undefined, { completionTimeMs: elapsed }))
    }
  }, [challenge.kind, elapsed, tier, onResult])

  useEffect(() => {
    if (challenge.id !== 'three-point-hold' || progress < 3 || threeHoldStarted.current === undefined) return
    const required = tier === 3 ? 1050 : 800
    const duration = elapsed - threeHoldStarted.current
    if (duration >= required) onResult(success('THREE-POINT STABILITY', 1, `${Math.round(duration)}ms stable`, duration, { pointerCount: 3, completionTimeMs: elapsed }))
  }, [challenge.id, elapsed, onResult, progress, tier])

  useEffect(() => {
    if (challenge.kind !== 'scratch-scan' || !scratchCanvas.current) return
    const canvas = scratchCanvas.current
    const drawMask = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.globalCompositeOperation = 'source-over'
      context.fillStyle = '#4a4e47'
      context.fillRect(0, 0, rect.width, rect.height)
      context.strokeStyle = '#6a6f66'
      context.lineWidth = 1
      for (let x = 0; x < rect.width; x += 22) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(Math.max(0, x - rect.height * 0.25), rect.height)
        context.stroke()
      }
      scratchBins.current.clear()
      scratchLastPoint.current = undefined
      setScratchProgress(0)
    }
    drawMask()
    const observer = new ResizeObserver(drawMask)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [challenge.kind])

  const recordDown = (event: React.PointerEvent<HTMLElement>) => {
    pointerStarts.current.set(event.pointerId, { point: { x: event.clientX, y: event.clientY }, time: performance.now() })
  }

  const renderBasic = () => (
    <button className="tap-target tactile touch-sensor" onPointerDown={action(() => onResult(success('CONTACT VERIFIED', 0.98, `${Math.round(elapsed)}ms response`, elapsed, { reactionMs: elapsed, completionTimeMs: elapsed })))} aria-label="Touch calibration sensor">
      <span /><small>SENSOR_01</small>
    </button>
  )

  const renderHold = () => {
    const target = challenge.tuning?.targetMs ?? 1500
    const tolerance = tierValue(challenge.tuning?.toleranceMs, tier, 120)
    return (
      <button
        className={`hold-target tactile ${phase ? 'is-held' : ''}`}
        onPointerDown={action(event => {
          event.currentTarget.setPointerCapture(event.pointerId)
          firstHold.current = elapsed
          setHoldStartElapsed(elapsed)
          setPhase(1)
        })}
        onPointerUp={event => {
          event.preventDefault()
          const duration = elapsed - (firstHold.current ?? elapsed)
          const error = Math.abs(duration - target)
          const delta = duration - target
          const metrics = { timingErrorMs: error, completionTimeMs: elapsed }
          if (error <= tolerance) onResult(success(error < 25 ? 'PRECISE INPUT' : 'DURATION VERIFIED', 1 - error / tolerance, `${(duration / 1000).toFixed(3)}s / ${delta < 0 ? `${Math.round(-delta)}ms early` : `${Math.round(delta)}ms late`}`, error, metrics))
          else onResult(failure(duration < target ? 'RELEASED EARLY' : 'RELEASED LATE', `${(duration / 1000).toFixed(3)}s / target ${(target / 1000).toFixed(3)}s / delta ${delta >= 0 ? '+' : ''}${Math.round(delta)}ms`, error, metrics, error / tolerance))
        }}
        onPointerCancel={() => onResult(failure('CONTACT CANCELLED', 'Continuous hold was interrupted.', undefined, { completionTimeMs: elapsed }))}
      >
        <span className="hold-target__fill" />
        <b>{phase ? ((elapsed - holdStartElapsed) / 1000).toFixed(3) : 'PRESS AND HOLD'}</b>
        <small>TARGET {(target / 1000).toFixed(3)}s</small>
      </button>
    )
  }

  const renderNeedle = () => {
    const rotationMs = [1900, 1350, 950][tier - 1] ?? 1350
    const angle = (elapsed % rotationMs) / rotationMs * 360
    const targetAngle = challenge.tuning?.targetAngleDeg ?? 95
    const tolerance = tierValue(challenge.tuning?.tolerance, tier, 21)
    const renderedAngle = challenge.id === 'reverse-dial' ? (360 - angle) % 360 : angle
    return (
      <button className="dial" onPointerDown={action(() => {
        const error = angleDifference(renderedAngle, targetAngle)
        const metrics = { swipeAngleErrorDeg: error, completionTimeMs: elapsed }
        if (error <= tolerance) onResult(success(error < 4 ? 'PRECISE INPUT' : 'SECTOR LOCKED', 1 - error / tolerance, `${error.toFixed(1)} degrees from center`, error, metrics))
        else onResult(failure('SECTOR MISSED', `${error.toFixed(1)} degrees from center`, error, metrics, error / tolerance))
      })}>
        <span className="dial__zone" style={{ transform: `rotate(${targetAngle}deg)` }} />
        <i className="dial__needle" style={{ transform: `rotate(${renderedAngle}deg)` }} />
        <b>TOUCH TO LOCK</b>
      </button>
    )
  }

  const renderShrinking = () => {
    const duration = 4300 - tier * 250
    const ratio = Math.max(0.18, 1 - elapsed / duration * 0.82)
    return <button className="shrink-target tactile" style={{ transform: `scale(${ratio})` }} onPointerDown={action(() => {
      const risk = Math.min(1, elapsed / duration)
      onResult(success(risk > 0.88 ? 'MINIMUM WINDOW' : 'CONTACT VERIFIED', 0.6 + risk * 0.4, `${Math.round(ratio * 100)}% sensor scale`, ratio * 100, { completionTimeMs: elapsed }))
    })}>CONTACT<small>{Math.round(ratio * 100)}%</small></button>
  }

  const renderSimultaneous = () => {
    const tolerance = tierValue(challenge.tuning?.toleranceMs, tier, 120)
    const down = (target: number) => action<HTMLElement>(event => {
      event.currentTarget.setPointerCapture(event.pointerId)
      simultaneousContacts.current.set(event.pointerId, { target, time: performance.now() })
      const contacts = [...simultaneousContacts.current.entries()]
      const left = contacts.find(([, item]) => item.target === 0)
      const right = contacts.find(([, item]) => item.target === 1)
      if (!left || !right || left[0] === right[0]) return
      const difference = Math.abs(left[1].time - right[1].time)
      const metrics = { simultaneousDeltaMs: difference, pointerCount: 2, completionTimeMs: elapsed }
      if (difference <= tolerance) onResult(success(difference < 35 ? 'BILATERAL PRECISION' : 'CONTACTS SYNCHRONIZED', 1 - difference / tolerance, `${Math.round(difference)}ms contact delta`, difference, metrics))
      else onResult(failure('CONTACTS DESYNCHRONIZED', `${Math.round(difference)}ms delta / limit ${tolerance}ms`, difference, metrics, difference / tolerance))
    })
    const end = (event: React.PointerEvent<HTMLElement>) => simultaneousContacts.current.delete(event.pointerId)
    return <div className={`split-targets ${challenge.id === 'bilateral-corners' ? 'split-targets--corners' : ''}`}><button className="multi-target tactile" onPointerDown={down(0)} onPointerUp={end} onPointerCancel={end}>L<small>SENSOR_01</small></button><button className="multi-target tactile" onPointerDown={down(1)} onPointerUp={end} onPointerCancel={end}>R<small>SENSOR_02</small></button></div>
  }

  const completeSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStarts.current.get(event.pointerId)
    if (!start) return
    const end = { x: event.clientX, y: event.clientY }
    const length = distance(start.point, end)
    const duration = Math.max(1, performance.now() - start.time)
    const baseMetrics = { swipeDistancePx: length, completionTimeMs: elapsed }
    if (challenge.kind === 'distance-swipe') {
      const target = challenge.tuning?.targetDistancePx ?? 300
      const tolerance = tierValue(challenge.tuning?.tolerance, tier, 42)
      const error = Math.abs(length - target)
      const metrics = { ...baseMetrics, precisionErrorPx: error }
      if (error <= tolerance) onResult(success(error < 8 ? 'PRECISE INPUT' : 'DISTANCE VERIFIED', 1 - error / tolerance, `${Math.round(length)}px / ${Math.round(error)}px error`, error, metrics))
      else onResult(failure(length < target ? 'VECTOR TOO SHORT' : 'VECTOR TOO LONG', `${Math.round(length)}px / target ${target}px`, error, metrics, error / tolerance))
      return
    }
    if (challenge.kind === 'angle-swipe') {
      const angle = Math.atan2(end.y - start.point.y, end.x - start.point.x) * 180 / Math.PI
      const target = challenge.tuning?.targetAngleDeg ?? -45
      const tolerance = tierValue(challenge.tuning?.tolerance, tier, 15)
      const error = angleDifference(angle, target)
      const metrics = { ...baseMetrics, swipeAngleErrorDeg: error }
      if (length < 90) onResult(failure('VECTOR TOO SHORT', `${Math.round(length)}px movement`, length, metrics))
      else if (error <= tolerance) onResult(success(error < 3 ? 'PRECISE VECTOR' : 'ANGLE VERIFIED', 1 - error / tolerance, `${angle.toFixed(1)} degrees / delta ${error.toFixed(1)} degrees`, error, metrics))
      else onResult(failure('ANGLE INVALID', `${angle.toFixed(1)} degrees / target ${target} degrees`, error, metrics, error / tolerance))
      return
    }
    if (challenge.kind === 'speed-swipe') {
      const velocity = length / duration * 1000
      const target = challenge.tuning?.targetVelocityPxPerSecond ?? 900
      const tolerance = tierValue(challenge.tuning?.tolerance, tier, 210)
      const error = Math.abs(velocity - target)
      const metrics = { ...baseMetrics, swipeVelocityPxPerSecond: velocity }
      if (length < 90) onResult(failure('VECTOR TOO SHORT', `${Math.round(length)}px movement`, length, metrics))
      else if (error <= tolerance) onResult(success(error < 45 ? 'PRECISE VELOCITY' : 'VELOCITY VERIFIED', 1 - error / tolerance, `${Math.round(velocity)}px/s / delta ${Math.round(error)}px/s`, error, metrics))
      else onResult(failure(velocity < target ? 'VECTOR TOO SLOW' : 'VECTOR TOO FAST', `${Math.round(velocity)}px/s / target ${target}px/s`, error, metrics, error / tolerance))
      return
    }
    const actual = swipeDirection(start.point, end)
    const expected = opposite ? 'left' : 'right'
    if (length < 70) onResult(failure('CONTACT DID NOT TRAVEL', `${Math.round(length)}px movement`, length, baseMetrics))
    else if (actual === expected) onResult(success('VECTOR VERIFIED', Math.min(1, length / 260), `${Math.round(length)}px ${actual}`, length, baseMetrics))
    else onResult(failure('DIRECTION INVALID', `Measured ${actual}; ${expected} required.`, length, baseMetrics))
  }

  const renderSwipe = () => (
    <div className="swipe-pad" onPointerDown={event => { recordDown(event); event.currentTarget.setPointerCapture(event.pointerId) }} onPointerUp={completeSwipe} onPointerCancel={() => onResult(failure('VECTOR CANCELLED', 'Contact ended before a valid release.'))}>
      <span>{challenge.kind === 'distance-swipe' ? `${challenge.tuning?.targetDistancePx ?? 300} px` : challenge.kind === 'angle-swipe' ? '45 DEG / UP-RIGHT' : challenge.kind === 'speed-swipe' ? `${challenge.tuning?.targetVelocityPxPerSecond ?? 900} px/s` : opposite ? 'INVERTED VECTOR' : 'ORIGIN UNRESTRICTED'}</span>
      <i>{challenge.kind === 'angle-swipe' ? '↗' : '→'}</i><small>RELEASE TO MEASURE</small>
    </div>
  )

  const renderTrace = () => (
    <div ref={traceArea} className="trace-area calibration-field" onPointerDown={event => {
      event.currentTarget.setPointerCapture(event.pointerId)
      const rect = event.currentTarget.getBoundingClientRect()
      tracePoints.current = [{ x: event.clientX - rect.left, y: event.clientY - rect.top }]
      setPhase(1)
    }} onPointerMove={event => {
      if (!phase) return
      const rect = event.currentTarget.getBoundingClientRect()
      tracePoints.current.push({ x: event.clientX - rect.left, y: event.clientY - rect.top })
      setProgress(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)))
    }} onPointerUp={event => {
      const rect = event.currentTarget.getBoundingClientRect()
      tracePoints.current.push({ x: event.clientX - rect.left, y: event.clientY - rect.top })
      const measured = traceCoverage(tracePoints.current, rect.width, rect.height)
      const tolerance = [62, 45, 34][tier - 1] ?? 45
      const metrics = { pathCoverage: measured.coverage, maxPathErrorPx: measured.maxError, completionTimeMs: elapsed }
      if (measured.coverage > 0.88 && measured.maxError <= tolerance) onResult(success(measured.maxError < 18 ? 'PRECISE TRACE' : 'SIGNAL RESTORED', 1 - measured.maxError / tolerance, `${Math.round(measured.maxError)}px maximum drift`, measured.maxError, metrics))
      else onResult(failure(measured.coverage <= 0.88 ? 'TRACE INCOMPLETE' : 'TOLERANCE EXCEEDED', `${Math.round(measured.maxError)}px maximum drift`, measured.maxError, metrics, measured.coverage <= 0.88 ? 1 : measured.maxError / tolerance))
    }} onPointerCancel={() => onResult(failure('TRACE CANCELLED', 'Continuous contact was interrupted.'))}>
      <svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true"><polyline points={TRACE_GUIDE_POINTS} /><polyline className="trace-progress" pathLength="1" strokeDasharray={`${progress} 1`} points={TRACE_GUIDE_POINTS} /></svg>
      <span className="trace-start">ORIGIN</span><span className="trace-end">ENDPOINT</span>
    </div>
  )

  const renderDoNothing = () => <div className="temptation inhibition-field" onPointerDown={() => onResult(failure('UNAUTHORIZED CONTACT', 'The required response was no response.', undefined, { completionTimeMs: elapsed }))}><span>DO NOT TOUCH</span>{elapsed > 1800 && <small>INPUT DRIVER REQUESTING ATTENTION</small>}</div>

  const holdTarget = (name: string, afterDown?: () => void) => ({
    onPointerDown: action((event: React.PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      heldTargets.current.set(name, event.pointerId)
      held.current.add(event.pointerId)
      setProgress(held.current.size)
      afterDown?.()
    }),
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      heldTargets.current.delete(name)
      held.current.delete(event.pointerId)
      setProgress(held.current.size)
      if (challenge.id === 'three-point-hold' && threeHoldStarted.current !== undefined) onResult(failure('STABILITY LOST', `${held.current.size} of 3 contacts remain`, undefined, { pointerCount: held.current.size }))
    },
    onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => {
      heldTargets.current.delete(name)
      held.current.delete(event.pointerId)
      setProgress(held.current.size)
      onResult(failure('CONTACT CANCELLED', `${name.toUpperCase()} sensor lost contact`, undefined, { pointerCount: held.current.size }))
    },
  })

  const renderHoldTap = () => <div className="hold-tap-layout"><button className={`hold-node ${heldTargets.current.has('a') ? 'active' : ''}`} {...holdTarget('a')}>HOLD A</button><button className="tap-node" onPointerDown={action(event => {
    if (heldTargets.current.has('a') && heldTargets.current.get('a') !== event.pointerId) onResult(success('COORDINATION VERIFIED', 0.95, 'A remained held', undefined, { pointerCount: 2, completionTimeMs: elapsed }))
    else onResult(failure('ANCHOR NOT HELD', 'Use a second contact for B.'))
  })}>TOUCH B</button></div>

  const renderTwister = () => <div className="twister-grid">{[1, 2, 3, 4].map(number => {
    if (number === 1 || number === 3) return <button key={number} className={`twister-node n${number}`} {...holdTarget(String(number))}>{number}</button>
    if (number === 2) return <button key={number} className="twister-node n2" onPointerDown={() => onResult(failure('UNREQUESTED SENSOR', 'Sensor 2 was not requested.'))}>{number}</button>
    return <button key={number} className="twister-node n4" onPointerDown={action(event => {
      const valid = heldTargets.current.has('1') && heldTargets.current.has('3') && ![...heldTargets.current.values()].includes(event.pointerId)
      onResult(valid ? success('CONTACT MATRIX VERIFIED', 1, 'Three independent contacts', undefined, { pointerCount: 3, completionTimeMs: elapsed }) : failure('CONTACT ORDER INVALID', 'Hold 1 and 3 before touching 4.'))
    })}>{number}</button>
  })}</div>

  const renderReplacement = () => <button className="replacement-target" onPointerDown={action(event => {
    held.current.add(event.pointerId)
    if (firstHold.current === undefined) firstHold.current = event.pointerId
    else if (held.current.size >= 2) replacementOverlap.current = true
    setProgress(held.current.size)
  })} onPointerUp={event => {
    const wasFirst = event.pointerId === firstHold.current
    held.current.delete(event.pointerId)
    if (wasFirst && replacementOverlap.current && held.current.size >= 1) onResult(success('TRANSFER VERIFIED', 1, 'Zero contact gap', 0, { pointerCount: 2, completionTimeMs: elapsed }))
    else if (held.current.size === 0) onResult(failure('CONTACT LOST', 'Add the new contact before releasing the first.'))
  }} onPointerCancel={() => onResult(failure('CONTACT CANCELLED', 'Transfer continuity could not be verified.'))}><b>{progress === 0 ? 'PLACE CONTACT' : progress === 1 ? 'ADD NEW CONTACT' : 'RELEASE FIRST'}</b><span>{progress} ACTIVE CONTACT{progress === 1 ? '' : 'S'}</span></button>

  const renderMoving = () => <button className="moving-target tactile" style={{ '--speed': `${[4.2, 3.1, 2.3][tier - 1]}s` } as React.CSSProperties} onPointerDown={action(() => onResult(success('INTERCEPT VERIFIED', 0.9, `${Math.round(elapsed)}ms response`, elapsed, { reactionMs: elapsed, completionTimeMs: elapsed })))}>SENSOR<small>TRACK</small></button>

  const renderRunaway = () => <button className="runaway-target tactile" style={{ left: `${runaway.x}%`, top: `${runaway.y}%` }} onPointerDown={action(() => {
    if (runaway.escapes >= (tier === 3 ? 2 : 1)) onResult(success('SENSOR CONTAINED', 0.88, `${runaway.escapes + 1} contacts`, undefined, { completionTimeMs: elapsed }))
    else setRunaway({ x: 18 + random() * 64, y: 20 + random() * 58, escapes: runaway.escapes + 1 })
  })}>CONTAIN</button>

  const renderDrag = () => {
    const moving = challenge.kind === 'moving-safe-path'
    const drop = challenge.kind === 'precision-drop'
    const hazardY = 50 + Math.sin(elapsed / 420) * 28
    const coordinates = (event: React.PointerEvent<HTMLButtonElement>) => {
      const rect = dragArea.current?.getBoundingClientRect()
      if (!rect) return dragPosition.current
      return { x: Math.max(5, Math.min(95, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(8, Math.min(92, (event.clientY - rect.top) / rect.height * 100)) }
    }
    const move = (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!phase) return
      const next = coordinates(event)
      const clientPoint = { x: event.clientX, y: event.clientY }
      const previous = lastDragPoint.current ?? clientPoint
      setPosition(next)
      lastDragPoint.current = clientPoint
      if (!drop) {
        const sample = event.currentTarget.getBoundingClientRect()
        const intersectsVisibleHazard = (element: HTMLElement | null) => {
          if (!element) return false
          const hazard = element.getBoundingClientRect()
          return segmentIntersectsRect(previous, clientPoint, {
            left: hazard.left - sample.width / 2,
            top: hazard.top - sample.height / 2,
            right: hazard.right + sample.width / 2,
            bottom: hazard.bottom + sample.height / 2,
          })
        }
        const staticHit = intersectsVisibleHazard(staticHazard.current)
        const movingHit = moving && intersectsVisibleHazard(movingHazard.current)
        if (staticHit || movingHit) onResult(failure('HAZARD CONTACT', `Collision at ${Math.round(next.x)}, ${Math.round(next.y)}`, undefined, { completionTimeMs: elapsed }))
      }
    }
    const release = (event: React.PointerEvent<HTMLButtonElement>) => {
      const final = coordinates(event)
      setPosition(final)
      setPhase(0)
      const target = dragGoal.current?.getBoundingClientRect()
      const errorPx = target ? Math.hypot(event.clientX - (target.left + target.width / 2), event.clientY - (target.top + target.height / 2)) : Number.POSITIVE_INFINITY
      const tolerancePx = target ? Math.min(target.width, target.height) / 2 : 0
      if (drop) {
        const metrics = { precisionErrorPx: errorPx, completionTimeMs: elapsed }
        if (errorPx <= tolerancePx) onResult(success(errorPx < 8 ? 'TRUE CENTER' : 'PLACEMENT VERIFIED', 1 - errorPx / tolerancePx, `${errorPx.toFixed(1)}px from center`, errorPx, metrics))
        else onResult(failure('PLACEMENT OUTSIDE TOLERANCE', `${errorPx.toFixed(1)}px from center / ${tolerancePx.toFixed(1)}px allowed`, errorPx, metrics, errorPx / Math.max(1, tolerancePx)))
      } else if (errorPx <= tolerancePx) onResult(success('TRANSFER VERIFIED', 0.9, 'No hazard contact; endpoint reached', errorPx, { precisionErrorPx: errorPx, completionTimeMs: elapsed }))
      else onResult(failure('ENDPOINT NOT REACHED', 'Release the sample inside the endpoint ring.'))
    }
    const dropDiameter = [144, 112, 86][tier - 1] ?? 112
    return <div ref={dragArea} className="drag-course calibration-field"><span className="drag-start">ORIGIN</span><span ref={dragGoal} className="drag-goal" style={drop ? { left: '76%', top: '50%', width: dropDiameter, height: dropDiameter } : undefined}>{drop ? 'TRUE CENTER' : 'ENDPOINT'}</span>{!drop && <i ref={staticHazard} className="path-hazard h1" data-danger="true" />}{moving && <i ref={movingHazard} className="path-hazard h2" data-danger="true" style={{ top: `${hazardY}%` }} />}<button className="drag-orb tactile" style={{ left: `${position.x}%`, top: `${position.y}%` }} onPointerDown={action(event => { event.currentTarget.setPointerCapture(event.pointerId); setPhase(1); lastDragPoint.current = { x: event.clientX, y: event.clientY } })} onPointerMove={move} onPointerUp={release} onPointerCancel={() => onResult(failure('TRANSFER CANCELLED', 'Continuous contact was interrupted.'))}>+</button></div>
  }

  const renderMultiHold = () => {
    if (challenge.id === 'three-point-hold') {
      const afterDown = () => {
        queueMicrotask(() => {
          if (held.current.size === 3 && threeHoldStarted.current === undefined) threeHoldStarted.current = elapsed
        })
      }
      return <div className="three-hold-layout">{['a', 'b', 'c'].map((name, index) => <button key={name} className="hold-node" {...holdTarget(name, afterDown)}>{String(index + 1).padStart(2, '0')}</button>)}</div>
    }
    return <div className="multi-hold-layout"><button className="hold-node" {...holdTarget('left')}>HOLD</button><button className="pix-tap" onPointerDown={action(event => {
      const valid = heldTargets.current.has('left') && heldTargets.current.has('right') && ![...heldTargets.current.values()].includes(event.pointerId)
      onResult(valid ? success('PIX CONTAINED', 1, 'Two anchors and PIX contact', undefined, { pointerCount: 3, completionTimeMs: elapsed }) : failure('ANCHORS RELEASED', 'Hold both side sensors first.'))
    })}><Pix mood="panic" /></button><button className="hold-node" {...holdTarget('right')}>HOLD</button></div>
  }

  const normalizedSweep = (speed: number, offset = 0) => {
    const cycle = ((elapsed + offset) % speed) / speed
    return cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2
  }

  const renderPressure = () => {
    const value = normalizedSweep([1900, 1400, 960][tier - 1] ?? 1400)
    const center = challenge.tuning?.targetValue ?? 0.72
    const tolerance = tierValue(challenge.tuning?.tolerance, tier, 0.1)
    return <button className="meter" style={{ '--meter-center': `${center * 100}%`, '--meter-zone': `${tolerance * 200}%` } as React.CSSProperties} onPointerDown={action(() => {
      const error = Math.abs(value - center)
      const metrics = { timingErrorMs: error * 1000, completionTimeMs: elapsed }
      if (error <= tolerance) onResult(success(error < 0.02 ? 'PRECISE LOAD' : 'LOAD VERIFIED', 1 - error / tolerance, `${Math.round(value * 100)}% measured / delta ${Math.round(error * 100)}%`, error * 100, metrics))
      else onResult(failure('LOAD OUTSIDE TOLERANCE', `${Math.round(value * 100)}% measured / target ${Math.round(center * 100)}%`, error * 100, metrics, error / tolerance))
    })}><span className="meter__zone" /><i style={{ left: `${value * 100}%` }} /><b>TOUCH TO LOCK</b><small>{Math.round(value * 100)}%</small></button>
  }

  const renderBeat = () => {
    const beat = [1300, 1050, 820][tier - 1] ?? 1050
    const cycle = elapsed % beat
    const error = Math.min(cycle, beat - cycle)
    const tolerance = tierValue(challenge.tuning?.toleranceMs, tier, 105)
    const distanceFromBeat = Math.min(cycle / beat, 1 - cycle / beat) * 2
    const scale = 0.55 + distanceFromBeat * 0.68
    return <button className={`beat-target ${challenge.id === 'human-pulse' ? 'beat-target--pulse' : ''}`} onPointerDown={action(() => {
      const metrics = { timingErrorMs: error, completionTimeMs: elapsed }
      if (error <= tolerance) onResult(success(error < 22 ? 'PRECISE PULSE' : 'PULSE VERIFIED', 1 - error / tolerance, `${Math.round(error)}ms timing error`, error, metrics))
      else onResult(failure('PULSE MISALIGNED', `${Math.round(error)}ms timing error`, error, metrics, error / tolerance))
    })}><i style={{ transform: `scale(${scale})`, opacity: 1 - distanceFromBeat * 0.5 }} /><span>TOUCH</span></button>
  }

  const renderRedGreen = () => {
    const interval = [900, 700, 520][tier - 1] ?? 700
    const clear = Math.floor(elapsed / interval) % 3 === 2
    return <button className={`signal-button ${clear ? 'green' : 'red'}`} onPointerDown={action(() => onResult(clear ? success('CLEARANCE VERIFIED', 0.95, `${Math.round(elapsed)}ms response`, elapsed, { reactionMs: elapsed, completionTimeMs: elapsed }) : failure('CONTACT BEFORE CLEARANCE', 'Wait for the CLEAR state.')))}><span>{clear ? 'CLEAR' : 'HOLD'}</span><small>{clear ? 'CONTACT AUTHORIZED' : 'CONTACT PROHIBITED'}</small></button>
  }

  const renderQuadrant = () => {
    const expected = opposite ? 1 : 2
    const labels = ['UPPER LEFT', 'UPPER RIGHT', 'LOWER LEFT', 'LOWER RIGHT']
    return <div className="quadrant-grid">{labels.map((label, index) => <button key={label} aria-label={label} onPointerDown={action(() => onResult(index === expected ? success('SECTOR VERIFIED', 1, label, undefined, { completionTimeMs: elapsed }) : failure('INCORRECT SECTOR', `Measured ${label.toLowerCase()}.`)))}><span>{String(index + 1).padStart(2, '0')}</span></button>)}</div>
  }

  const renderGestureSequence = () => {
    const onUp = (event: React.PointerEvent<HTMLDivElement>) => {
      const start = pointerStarts.current.get(event.pointerId)
      if (!start) return
      const length = distance(start.point, { x: event.clientX, y: event.clientY })
      const step = length > 80 ? 'swipe' : 'tap'
      gestureSteps.current.push(step)
      setProgress(gestureSteps.current.length)
      const expected = ['tap', 'swipe', 'tap']
      const index = gestureSteps.current.length - 1
      if (step !== expected[index]) onResult(failure('MOTOR SEQUENCE INVALID', `Step ${index + 1} measured ${step}.`))
      else if (gestureSteps.current.length === expected.length) onResult(success('MOTOR SEQUENCE VERIFIED', 0.95, 'Tap / swipe / tap', undefined, { sequenceLength: 3, completionTimeMs: elapsed }))
    }
    return <div className="gesture-pad" onPointerDown={event => { recordDown(event); event.currentTarget.setPointerCapture(event.pointerId) }} onPointerUp={onUp} onPointerCancel={() => onResult(failure('SEQUENCE CANCELLED', 'Active motor input was interrupted.'))}><div><b className={progress >= 1 ? 'done' : ''}>TAP</b><b className={progress >= 2 ? 'done' : ''}>SWIPE</b><b className={progress >= 3 ? 'done' : ''}>TAP</b></div><span>RESPONSE FIELD</span></div>
  }

  const renderAlternating = () => {
    const expected = progress % 2 === 0 ? 'left' : 'right'
    const tapsNeeded = 4 + tier * 2
    const tap = (side: 'left' | 'right') => action<HTMLElement>(() => {
      if (side !== expected) onResult(failure('ALTERNATION BROKEN', `${expected.toUpperCase()} was required.`))
      else if (progress + 1 >= tapsNeeded) onResult(success('LATERAL CONTROL VERIFIED', 0.95, `${tapsNeeded} valid contacts`, undefined, { sequenceLength: tapsNeeded, completionTimeMs: elapsed }))
      else setProgress(value => value + 1)
    })
    return <div className="alternating-layout"><button onPointerDown={tap('left')}>LEFT<small>{expected === 'left' ? 'ACTIVE' : 'STANDBY'}</small></button><b>{progress}/{tapsNeeded}</b><button onPointerDown={tap('right')}>RIGHT<small>{expected === 'right' ? 'ACTIVE' : 'STANDBY'}</small></button></div>
  }

  const renderDualMeters = () => {
    const values = [normalizedSweep(1260), normalizedSweep(930, 330)]
    const targets = [0.28, 0.74]
    const tolerance = tier === 3 ? 0.075 : 0.11
    const stop = (index: number) => action<HTMLElement>(() => {
      if (stops[index] !== undefined) return
      const next = [...stops]
      next[index] = values[index]!
      setStops(next)
      if (next.filter(value => value !== undefined).length === 2) {
        const errors = next.map((value, positionIndex) => Math.abs((value ?? 0) - targets[positionIndex]!))
        const worst = Math.max(...errors)
        const metrics = { timingErrorMs: worst * 1000, completionTimeMs: elapsed }
        if (worst <= tolerance) onResult(success('DUAL CALIBRATION VERIFIED', 1 - worst / tolerance, `${Math.round(worst * 100)}% worst offset`, worst * 100, metrics))
        else onResult(failure('METER OUTSIDE TOLERANCE', `${Math.round(worst * 100)}% worst offset`, worst * 100, metrics, worst / tolerance))
      }
    })
    return <div className="dual-meters">{[0, 1].map(index => <button key={index} className="mini-meter" onPointerDown={stop(index)}><span style={{ left: `${targets[index]! * 100}%` }} /><i style={{ left: `${(stops[index] ?? values[index])! * 100}%` }} /><b>{stops[index] === undefined ? `LOCK METER ${index + 1}` : 'LOCKED'}</b></button>)}</div>
  }

  const eraseScratch = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = scratchCanvas.current
    if (!canvas || !scratchLastPoint.current) return
    const rect = canvas.getBoundingClientRect()
    const next = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const context = canvas.getContext('2d')
    if (context) {
      context.globalCompositeOperation = 'destination-out'
      context.lineWidth = tier === 3 ? 32 : 44
      context.lineCap = 'round'
      context.beginPath()
      context.moveTo(scratchLastPoint.current.x, scratchLastPoint.current.y)
      context.lineTo(next.x, next.y)
      context.stroke()
    }
    const columns = 24
    const rows = 14
    const gridX = Math.floor(next.x / rect.width * columns)
    const gridY = Math.floor(next.y / rect.height * rows)
    for (let x = gridX - 1; x <= gridX + 1; x += 1) for (let y = gridY - 1; y <= gridY + 1; y += 1) if (x >= 0 && x < columns && y >= 0 && y < rows) scratchBins.current.add(`${x}:${y}`)
    scratchLastPoint.current = next
    const percent = scratchBins.current.size / (columns * rows) * 100
    setScratchProgress(percent)
    const threshold = tierValue(challenge.tuning?.revealThreshold, tier, 68)
    if (percent >= threshold) onResult(success('SENSOR SURFACE VERIFIED', Math.min(1, percent / threshold), `${percent.toFixed(1)}% revealed`, percent, { revealedPercent: percent, completionTimeMs: elapsed }))
  }

  const renderScratch = () => <div className={`scratch-field ${challenge.id === 'reveal-profile' ? 'scratch-field--profile' : ''}`}><div className="scratch-underlay"><Pix mood="idle" /><b>{challenge.id === 'reveal-profile' ? 'HUMAN PROFILE' : 'SENSOR CLEAN'}</b><span>HV / BIOLOGICAL SAMPLE</span></div><canvas ref={scratchCanvas} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); const rect = event.currentTarget.getBoundingClientRect(); scratchLastPoint.current = { x: event.clientX - rect.left, y: event.clientY - rect.top } }} onPointerMove={eraseScratch} onPointerUp={() => { scratchLastPoint.current = undefined }} onPointerCancel={() => { scratchLastPoint.current = undefined }} /><output>{scratchProgress.toFixed(1)}% REVEALED</output></div>

  const renderDrawShape = () => {
    const finish = (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const points = drawPoints.current
      if (points.length < 8) { onResult(failure('TRACE TOO SHORT', `${points.length} samples captured`)); return }
      const analysis = challenge.id === 'draw-chevron' ? (() => {
        const a = { x: rect.width * 0.15, y: rect.height * 0.3 }
        const b = { x: rect.width * 0.5, y: rect.height * 0.72 }
        const c = { x: rect.width * 0.85, y: rect.height * 0.25 }
        const errorPx = points.reduce((sum, point) => sum + Math.min(pointToSegment(point, a, b), pointToSegment(point, b, c)), 0) / points.length
        const coverage = Math.min(1, (Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x))) / (rect.width * 0.7))
        return { errorPx, coverage, accuracy: Math.max(0, 1 - errorPx / (rect.height * 0.2)) * coverage }
      })() : (() => {
        const center = { x: rect.width / 2, y: rect.height / 2 }
        const radiusX = rect.width * 0.3
        const radiusY = rect.height * 0.3
        const radius = Math.min(radiusX, radiusY)
        const errorPx = points.reduce((sum, point) => {
          const ellipticalRadius = Math.hypot((point.x - center.x) / radiusX, (point.y - center.y) / radiusY)
          return sum + Math.abs(ellipticalRadius - 1) * radius
        }, 0) / points.length
        const angleBins = new Set(points.map(point => Math.floor(((Math.atan2(point.y - center.y, point.x - center.x) + Math.PI) / (Math.PI * 2)) * 24)))
        const coverage = angleBins.size / 24
        const closure = distance(points[0]!, points.at(-1)!)
        return { errorPx, coverage, accuracy: Math.max(0, 1 - errorPx / (radius * 0.45)) * coverage * Math.max(0, 1 - closure / (radius * 1.2)) }
      })()
      const { accuracy, coverage, errorPx } = analysis
      const threshold = tierValue(challenge.tuning?.tolerance, tier, 0.8)
      const metrics = { precisionErrorPx: errorPx, pathCoverage: coverage, completionTimeMs: elapsed }
      if (accuracy >= threshold) onResult(success('SHAPE VERIFIED', accuracy, `${Math.round(accuracy * 100)}% shape accuracy / ${errorPx.toFixed(1)}px mean error`, errorPx, metrics))
      else onResult(failure('SHAPE OUTSIDE TOLERANCE', `${Math.round(accuracy * 100)}% shape accuracy / required ${Math.round(threshold * 100)}%`, errorPx, metrics, (threshold - accuracy) / threshold))
    }
    const setVisiblePath = (points: Point[], rect: DOMRect) => setDrawPath(points.map(point => `${point.x / rect.width * 100},${point.y / rect.height * 100}`).join(' '))
    return <div className={`draw-field ${challenge.id === 'draw-ring' ? 'draw-field--ring' : ''}`} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); const rect = event.currentTarget.getBoundingClientRect(); drawPoints.current = [{ x: event.clientX - rect.left, y: event.clientY - rect.top }]; setVisiblePath(drawPoints.current, rect) }} onPointerMove={event => { if (!drawPoints.current.length) return; const rect = event.currentTarget.getBoundingClientRect(); const next = { x: event.clientX - rect.left, y: event.clientY - rect.top }; if (distance(drawPoints.current.at(-1)!, next) < 3) return; drawPoints.current.push(next); setVisiblePath(drawPoints.current, rect) }} onPointerUp={finish} onPointerCancel={() => onResult(failure('SHAPE CANCELLED', 'Continuous contact was interrupted.'))}><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{challenge.id === 'draw-ring' ? <circle className="draw-guide" cx="50" cy="50" r="30" /> : <polyline className="draw-guide" points="15,30 50,72 85,25" />}<polyline className="draw-input" points={drawPath} /></svg><span>ONE CONTINUOUS CONTACT</span></div>
  }

  switch (challenge.kind) {
    case 'basic-tap': return renderBasic()
    case 'exact-hold': return renderHold()
    case 'stop-needle': return renderNeedle()
    case 'shrinking-target': return renderShrinking()
    case 'simultaneous-tap': return renderSimultaneous()
    case 'swipe-direction':
    case 'distance-swipe':
    case 'angle-swipe':
    case 'speed-swipe': return renderSwipe()
    case 'trace-path': return renderTrace()
    case 'scratch-scan': return renderScratch()
    case 'draw-shape': return renderDrawShape()
    case 'do-nothing': return renderDoNothing()
    case 'hold-and-tap': return renderHoldTap()
    case 'finger-twister': return renderTwister()
    case 'finger-replacement': return renderReplacement()
    case 'moving-target': return renderMoving()
    case 'runaway-target': return renderRunaway()
    case 'safe-path':
    case 'moving-safe-path':
    case 'precision-drop': return renderDrag()
    case 'multi-object-hold': return renderMultiHold()
    case 'pressure-bar': return renderPressure()
    case 'tap-on-beat': return renderBeat()
    case 'red-green': return renderRedGreen()
    case 'screen-quadrant': return renderQuadrant()
    case 'gesture-sequence': return renderGestureSequence()
    case 'alternating-taps': return renderAlternating()
    case 'dual-meters': return renderDualMeters()
    default: return <div className="challenge-error">UNREGISTERED INTERACTION // {challenge.name}</div>
  }
}
