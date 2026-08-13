import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import '../styles/diagnostics.css'

type PointerPhase = 'DOWN' | 'MOVE' | 'UP' | 'CANCELLED' | 'CAPTURE LOST'
type CheckStatus = 'idle' | 'running' | 'complete'

interface PointerReading {
  sequence: number
  pointerId: number
  pointerType: string
  x: number
  y: number
  xRatio: number
  yRatio: number
  surfaceWidth: number
  surfaceHeight: number
  contactWidth: number
  contactHeight: number
  pressure: number
  buttons: number
  isPrimary: boolean
  phase: PointerPhase
  captured: boolean
  downAt: number
  elapsedMs: number
}

interface CheckTarget {
  x: number
  y: number
  label: string
}

interface CheckStep {
  id: string
  code: string
  title: string
  instruction: string
  targets: CheckTarget[]
}

interface CheckResult {
  stepId: string
  code: string
  detail: string
}

export interface TouchDiagnosticsProps {
  onClose?: () => void
}

const HISTORY_LIMIT = 80
const MOVE_LOG_INTERVAL_MS = 72
const CHECK_RADIUS = 0.105

const CHECK_STEPS: CheckStep[] = [
  {
    id: 'corner-nw',
    code: 'TC-01',
    title: 'UPPER LEFT SENSOR',
    instruction: 'Touch the inset marker in the upper-left corner.',
    targets: [{ x: 0.12, y: 0.16, label: 'NW' }],
  },
  {
    id: 'corner-ne',
    code: 'TC-02',
    title: 'UPPER RIGHT SENSOR',
    instruction: 'Touch the inset marker in the upper-right corner.',
    targets: [{ x: 0.88, y: 0.16, label: 'NE' }],
  },
  {
    id: 'corner-sw',
    code: 'TC-03',
    title: 'LOWER LEFT SENSOR',
    instruction: 'Touch the inset marker in the lower-left corner.',
    targets: [{ x: 0.12, y: 0.84, label: 'SW' }],
  },
  {
    id: 'corner-se',
    code: 'TC-04',
    title: 'LOWER RIGHT SENSOR',
    instruction: 'Touch the inset marker in the lower-right corner.',
    targets: [{ x: 0.88, y: 0.84, label: 'SE' }],
  },
  {
    id: 'center',
    code: 'TC-05',
    title: 'CENTRAL SENSOR',
    instruction: 'Touch the center marker.',
    targets: [{ x: 0.5, y: 0.5, label: 'C' }],
  },
  {
    id: 'dual',
    code: 'TC-06',
    title: 'BILATERAL INPUT',
    instruction: 'Place and hold one finger on each marker at the same time.',
    targets: [
      { x: 0.3, y: 0.56, label: 'L' },
      { x: 0.7, y: 0.56, label: 'R' },
    ],
  },
]

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

const formatCoordinate = (value: number) => `${Math.round(value)} px`
const formatContact = (value: number) => `${value.toFixed(1)} px`
const formatPressure = (value: number) => value.toFixed(3)
const formatPointerType = (pointerType: string) => pointerType.toUpperCase()

function targetContains(pointer: PointerReading, target: CheckTarget) {
  const dx = (pointer.xRatio - target.x) * pointer.surfaceWidth
  const dy = (pointer.yRatio - target.y) * pointer.surfaceHeight
  const radius = Math.min(pointer.surfaceWidth, pointer.surfaceHeight) * CHECK_RADIUS
  return Math.hypot(dx, dy) <= radius
}

function findDualPair(pointers: PointerReading[], targets: CheckTarget[]) {
  const [firstTarget, secondTarget] = targets
  if (!firstTarget || !secondTarget) return undefined
  const touchPointers = pointers.filter(pointer => pointer.pointerType === 'touch')
  for (const first of touchPointers) {
    if (!targetContains(first, firstTarget)) continue
    const second = touchPointers.find(pointer => pointer.pointerId !== first.pointerId && targetContains(pointer, secondTarget))
    if (second) return [first, second] as const
  }
  return undefined
}

export function TouchDiagnostics({ onClose }: TouchDiagnosticsProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const activePointersRef = useRef(new Map<number, PointerReading>())
  const sequenceRef = useRef(0)
  const startedAtRef = useRef(performance.now())
  const lastMoveLoggedRef = useRef(new Map<number, number>())
  const checkStatusRef = useRef<CheckStatus>('idle')
  const checkStepRef = useRef(0)

  const [activePointers, setActivePointers] = useState<PointerReading[]>([])
  const [history, setHistory] = useState<PointerReading[]>([])
  const [maxContacts, setMaxContacts] = useState(0)
  const [checkStatus, setCheckStatus] = useState<CheckStatus>('idle')
  const [checkStep, setCheckStep] = useState(0)
  const [checkResults, setCheckResults] = useState<CheckResult[]>([])
  const [checkNotice, setCheckNotice] = useState('TOUCH CHECK NOT ARMED')

  const currentCheck = checkStatus === 'running' ? CHECK_STEPS[checkStep] : undefined
  const orderedActivePointers = useMemo(
    () => activePointers.slice().sort((first, second) => first.pointerId - second.pointerId),
    [activePointers],
  )

  const syncActivePointers = useCallback(() => {
    const next = [...activePointersRef.current.values()]
    const activeTouchCount = next.filter(pointer => pointer.pointerType === 'touch').length
    setActivePointers(next)
    setMaxContacts(previous => Math.max(previous, activeTouchCount))
  }, [])

  const appendHistory = useCallback((reading: PointerReading) => {
    if (reading.phase === 'MOVE') {
      const lastLogged = lastMoveLoggedRef.current.get(reading.pointerId) ?? -Infinity
      if (reading.elapsedMs - lastLogged < MOVE_LOG_INTERVAL_MS) return
      lastMoveLoggedRef.current.set(reading.pointerId, reading.elapsedMs)
    } else if (reading.phase === 'UP' || reading.phase === 'CANCELLED' || reading.phase === 'CAPTURE LOST') {
      lastMoveLoggedRef.current.delete(reading.pointerId)
    }
    setHistory(previous => [reading, ...previous].slice(0, HISTORY_LIMIT))
  }, [])

  const createReading = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    phase: PointerPhase,
    captured: boolean,
    downAt?: number,
  ): PointerReading => {
    const rect = event.currentTarget.getBoundingClientRect()
    const now = performance.now()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    return {
      sequence: ++sequenceRef.current,
      pointerId: event.pointerId,
      pointerType: event.pointerType || 'unknown',
      x,
      y,
      xRatio: rect.width ? x / rect.width : 0,
      yRatio: rect.height ? y / rect.height : 0,
      surfaceWidth: rect.width,
      surfaceHeight: rect.height,
      contactWidth: event.width,
      contactHeight: event.height,
      pressure: event.pressure,
      buttons: event.buttons,
      isPrimary: event.isPrimary,
      phase,
      captured,
      downAt: downAt ?? now,
      elapsedMs: now - startedAtRef.current,
    }
  }, [])

  const completeCheckStep = useCallback((step: CheckStep, detail: string) => {
    const nextStep = checkStepRef.current + 1
    checkStepRef.current = nextStep
    setCheckResults(previous => [...previous, { stepId: step.id, code: step.code, detail }])

    if (nextStep >= CHECK_STEPS.length) {
      checkStatusRef.current = 'complete'
      setCheckStatus('complete')
      setCheckStep(nextStep)
      setCheckNotice('APPLICATION TOUCH ARRAY VERIFIED')
      return
    }

    const nextCheck = CHECK_STEPS[nextStep]
    if (!nextCheck) return
    setCheckStep(nextStep)
    setCheckNotice(`${step.code} REGISTERED // ADVANCE TO ${nextCheck.code}`)
  }, [])

  const evaluateCheck = useCallback((reading: PointerReading) => {
    if (checkStatusRef.current !== 'running' || reading.phase !== 'DOWN') return
    const step = CHECK_STEPS[checkStepRef.current]
    if (!step) return

    if (reading.pointerType !== 'touch') {
      setCheckNotice(`${formatPointerType(reading.pointerType)} SOURCE DETECTED // TOUCH INPUT REQUIRED`)
      return
    }

    if (step.targets.length === 1) {
      const target = step.targets[0]
      if (!target || !targetContains(reading, target)) {
        setCheckNotice(`${step.code} CONTACT OUTSIDE SENSOR // TRY AGAIN`)
        return
      }
      completeCheckStep(
        step,
        `ID ${reading.pointerId} // X ${Math.round(reading.x)} // Y ${Math.round(reading.y)}`,
      )
      return
    }

    const pair = findDualPair([...activePointersRef.current.values()], step.targets)
    if (!pair) {
      setCheckNotice(`${step.code} WAITING FOR TWO ACTIVE TOUCH CONTACTS`)
      return
    }

    const delta = Math.abs(pair[0].downAt - pair[1].downAt)
    completeCheckStep(
      step,
      `IDS ${pair[0].pointerId} + ${pair[1].pointerId} // CONTACT DELTA ${Math.round(delta)} ms`,
    )
  }, [completeCheckStep])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    let captured = false
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
      captured = event.currentTarget.hasPointerCapture(event.pointerId)
    } catch {
      // Capture is optional on pointer implementations that do not expose it.
    }

    const reading = createReading(event, 'DOWN', captured)
    activePointersRef.current.set(event.pointerId, reading)
    syncActivePointers()
    appendHistory(reading)
    evaluateCheck(reading)
  }, [appendHistory, createReading, evaluateCheck, syncActivePointers])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const active = activePointersRef.current.get(event.pointerId)
    if (!active) return
    event.preventDefault()
    const reading = createReading(
      event,
      'MOVE',
      event.currentTarget.hasPointerCapture(event.pointerId),
      active.downAt,
    )
    activePointersRef.current.set(event.pointerId, reading)
    syncActivePointers()
    appendHistory(reading)
  }, [appendHistory, createReading, syncActivePointers])

  const releasePointer = useCallback((event: ReactPointerEvent<HTMLDivElement>, phase: 'UP' | 'CANCELLED') => {
    const active = activePointersRef.current.get(event.pointerId)
    const reading = createReading(
      event,
      phase,
      event.currentTarget.hasPointerCapture(event.pointerId),
      active?.downAt,
    )
    activePointersRef.current.delete(event.pointerId)
    syncActivePointers()
    appendHistory(reading)

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Pointer capture may already be released by the user agent.
    }

    if (phase === 'CANCELLED' && checkStatusRef.current === 'running') {
      setCheckNotice(`POINTER ${event.pointerId} CANCELLED // REPEAT CURRENT SENSOR`)
    }
  }, [appendHistory, createReading, syncActivePointers])

  const handleLostPointerCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const active = activePointersRef.current.get(event.pointerId)
    if (!active) return
    const reading = createReading(event, 'CAPTURE LOST', false, active.downAt)
    activePointersRef.current.delete(event.pointerId)
    syncActivePointers()
    appendHistory(reading)
    if (checkStatusRef.current === 'running') {
      setCheckNotice(`POINTER ${event.pointerId} CAPTURE LOST // REPEAT CURRENT SENSOR`)
    }
  }, [appendHistory, createReading, syncActivePointers])

  const startCheck = useCallback(() => {
    checkStatusRef.current = 'running'
    checkStepRef.current = 0
    setCheckStatus('running')
    setCheckStep(0)
    setCheckResults([])
    setCheckNotice('TC-01 ARMED // TOUCH INPUT ONLY')
  }, [])

  const clearEventLog = useCallback(() => {
    setHistory([])
    setMaxContacts([...activePointersRef.current.values()].filter(pointer => pointer.pointerType === 'touch').length)
    lastMoveLoggedRef.current.clear()
    startedAtRef.current = performance.now()
  }, [])

  useEffect(() => () => {
    const surface = surfaceRef.current
    if (surface) {
      for (const pointerId of activePointersRef.current.keys()) {
        try {
          if (surface.hasPointerCapture(pointerId)) surface.releasePointerCapture(pointerId)
        } catch {
          // The user agent may have already released capture during unmount.
        }
      }
    }
    activePointersRef.current.clear()
    lastMoveLoggedRef.current.clear()
  }, [])

  return (
    <section className="touch-diagnostics" aria-label="AUH-09 touchscreen hardware diagnostics">
      <header className="touch-diagnostics__header">
        <div>
          <span className="touch-diagnostics__eyebrow">AreUHuman SYSTEM // AUH-09</span>
          <h1>TOUCH ARRAY DIAGNOSTIC</h1>
          <p>APPLICATION INPUT INSPECTION // NO OPERATING-SYSTEM CALIBRATION</p>
        </div>
        <div className="touch-diagnostics__header-status" aria-live="polite">
          <span>ACTIVE TOUCH POINTS</span>
          <strong>{orderedActivePointers.filter(pointer => pointer.pointerType === 'touch').length}</strong>
          <small>ALL POINTERS {orderedActivePointers.length} // MAX TOUCHES {maxContacts}</small>
        </div>
      </header>

      <div className="touch-diagnostics__controls" aria-label="Diagnostic controls">
        <button type="button" className="touch-diagnostics__primary" onClick={startCheck}>
          {checkStatus === 'idle' ? 'BEGIN TOUCH CHECK' : checkStatus === 'complete' ? 'RUN TOUCH CHECK AGAIN' : 'RESTART TOUCH CHECK'}
        </button>
        <button type="button" onClick={clearEventLog}>CLEAR EVENT LOG</button>
        {onClose && <button type="button" className="touch-diagnostics__exit" onClick={onClose}>EXIT DIAGNOSTIC</button>}
      </div>

      <div className="touch-diagnostics__layout">
        <section className="touch-diagnostics__field-panel" aria-labelledby="touch-field-title">
          <div className="touch-diagnostics__section-label">
            <span id="touch-field-title">INPUT SURFACE // LIVE</span>
            <span>POINTER EVENTS</span>
          </div>
          <div
            ref={surfaceRef}
            className="touch-diagnostics__surface"
            role="region"
            tabIndex={0}
            aria-label="Live touch input surface. Touch this area to inspect pointer data."
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={event => releasePointer(event, 'UP')}
            onPointerCancel={event => releasePointer(event, 'CANCELLED')}
            onLostPointerCapture={handleLostPointerCapture}
            onContextMenu={event => event.preventDefault()}
          >
            <span className="touch-diagnostics__axis touch-diagnostics__axis--horizontal" aria-hidden="true" />
            <span className="touch-diagnostics__axis touch-diagnostics__axis--vertical" aria-hidden="true" />

            {currentCheck?.targets.map((target, index) => {
              const targetStyle = {
                '--hv-target-x': `${target.x * 100}%`,
                '--hv-target-y': `${target.y * 100}%`,
              } as CSSProperties
              return (
                <div className="touch-diagnostics__target" style={targetStyle} key={`${currentCheck.id}-${target.label}`} aria-hidden="true">
                  <i />
                  <b>{target.label}</b>
                  <span>{currentCheck.code}.{index + 1}</span>
                </div>
              )
            })}

            {orderedActivePointers.map(pointer => {
              const pointerStyle = {
                '--hv-pointer-x': `${clamp(pointer.xRatio * 100, 0, 100)}%`,
                '--hv-pointer-y': `${clamp(pointer.yRatio * 100, 0, 100)}%`,
                '--hv-contact-w': `${clamp(pointer.contactWidth, 16, 88)}px`,
                '--hv-contact-h': `${clamp(pointer.contactHeight, 16, 88)}px`,
              } as CSSProperties
              return (
                <div className="touch-diagnostics__pointer" style={pointerStyle} key={pointer.pointerId} aria-hidden="true">
                  <i />
                  <b>{pointer.pointerId}</b>
                  <span>CONTACT_{String(pointer.pointerId).padStart(2, '0')}</span>
                </div>
              )
            })}

            {!orderedActivePointers.length && !currentCheck && (
              <div className="touch-diagnostics__surface-idle">
                <b>TOUCH SURFACE TO BEGIN INPUT INSPECTION</b>
                <span>POINTER DOWN / MOVE / UP / CANCEL ARE RECORDED</span>
              </div>
            )}
          </div>
        </section>

        <aside className="touch-diagnostics__side">
          <section className={`touch-diagnostics__check touch-diagnostics__check--${checkStatus}`} aria-labelledby="touch-check-title">
            <div className="touch-diagnostics__section-label">
              <span id="touch-check-title">TOUCH CHECK</span>
              <span>{checkStatus === 'complete' ? '06 / 06' : `${String(checkStep).padStart(2, '0')} / 06`}</span>
            </div>

            {checkStatus === 'idle' && (
              <div className="touch-diagnostics__check-copy">
                <strong>APPLICATION-LEVEL SENSOR CHECK</strong>
                <p>Verifies four inset corners, the center sensor, and two concurrent touch contacts.</p>
                <small>Mouse and pen activity remains visible but cannot complete this check.</small>
              </div>
            )}

            {currentCheck && (
              <div className="touch-diagnostics__check-copy">
                <span>{currentCheck.code} // STEP {String(checkStep + 1).padStart(2, '0')}</span>
                <strong>{currentCheck.title}</strong>
                <p>{currentCheck.instruction}</p>
                <small>Lift after each single-contact step. The final step requires two active touch IDs.</small>
              </div>
            )}

            {checkStatus === 'complete' && (
              <div className="touch-diagnostics__check-copy touch-diagnostics__check-copy--complete" role="status">
                <span>AUH-09 // INPUT REPORT</span>
                <strong>TOUCH ARRAY VERIFIED</strong>
                <p>Six application input checks registered through Pointer Events.</p>
                <small>This confirms browser input only. It does not modify device calibration.</small>
              </div>
            )}

            <div className="touch-diagnostics__notice" aria-live="polite">{checkNotice}</div>
            <ol className="touch-diagnostics__check-results" aria-label="Completed touch check steps">
              {checkResults.map(result => (
                <li key={result.stepId}>
                  <b>{result.code}</b>
                  <span>REGISTERED</span>
                  <small>{result.detail}</small>
                </li>
              ))}
            </ol>
          </section>

          <section className="touch-diagnostics__active" aria-labelledby="active-pointers-title">
            <div className="touch-diagnostics__section-label">
              <span id="active-pointers-title">ACTIVE POINTERS</span>
              <span>{orderedActivePointers.length}</span>
            </div>
            {!orderedActivePointers.length && <p>NO ACTIVE CONTACTS</p>}
            {orderedActivePointers.map(pointer => (
              <article key={pointer.pointerId}>
                <header>
                  <b>ID {pointer.pointerId}</b>
                  <span>{formatPointerType(pointer.pointerType)} // {pointer.phase}</span>
                </header>
                <dl>
                  <div><dt>X</dt><dd>{formatCoordinate(pointer.x)}</dd></div>
                  <div><dt>Y</dt><dd>{formatCoordinate(pointer.y)}</dd></div>
                  <div><dt>WIDTH</dt><dd>{formatContact(pointer.contactWidth)}</dd></div>
                  <div><dt>HEIGHT</dt><dd>{formatContact(pointer.contactHeight)}</dd></div>
                  <div><dt>PRESSURE</dt><dd>{formatPressure(pointer.pressure)}</dd></div>
                  <div><dt>CAPTURE</dt><dd>{pointer.captured ? 'HELD' : 'OPEN'}</dd></div>
                </dl>
              </article>
            ))}
          </section>
        </aside>
      </div>

      <section className="touch-diagnostics__history" aria-labelledby="event-history-title">
        <div className="touch-diagnostics__section-label">
          <span id="event-history-title">EVENT HISTORY // NEWEST FIRST</span>
          <span>{history.length} / {HISTORY_LIMIT}</span>
        </div>
        <div className="touch-diagnostics__table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">SEQ</th>
                <th scope="col">TIME</th>
                <th scope="col">STATE</th>
                <th scope="col">ID</th>
                <th scope="col">TYPE</th>
                <th scope="col">X</th>
                <th scope="col">Y</th>
                <th scope="col">WIDTH</th>
                <th scope="col">HEIGHT</th>
                <th scope="col">PRESSURE</th>
                <th scope="col">PRIMARY</th>
                <th scope="col">BUTTONS</th>
                <th scope="col">CAPTURE</th>
              </tr>
            </thead>
            <tbody>
              {!history.length && (
                <tr><td colSpan={13}>NO POINTER EVENTS RECORDED</td></tr>
              )}
              {history.map(reading => (
                <tr key={reading.sequence} data-phase={reading.phase}>
                  <td>{String(reading.sequence).padStart(4, '0')}</td>
                  <td>+{Math.round(reading.elapsedMs)} ms</td>
                  <td>{reading.phase}</td>
                  <td>{reading.pointerId}</td>
                  <td>{formatPointerType(reading.pointerType)}</td>
                  <td>{Math.round(reading.x)}</td>
                  <td>{Math.round(reading.y)}</td>
                  <td>{reading.contactWidth.toFixed(1)}</td>
                  <td>{reading.contactHeight.toFixed(1)}</td>
                  <td>{formatPressure(reading.pressure)}</td>
                  <td>{reading.isPrimary ? 'YES' : 'NO'}</td>
                  <td>{reading.buttons}</td>
                  <td>{reading.captured ? 'HELD' : 'OPEN'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="touch-diagnostics__footnote">
          PRESSURE, CONTACT WIDTH, AND CONTACT HEIGHT ARE RAW BROWSER VALUES AND MAY VARY BY HARDWARE. MOVE HISTORY IS
          DISPLAY-SAMPLED AT {MOVE_LOG_INTERVAL_MS} ms; ACTIVE MARKERS UPDATE ON EVERY RECEIVED MOVE.
        </p>
      </section>
    </section>
  )
}
