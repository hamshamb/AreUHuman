import { useMemo, useState } from 'react'
import { failure, success, usePausableClock, type RuntimeProps } from '../../game/challenges/runtime'
import { hashSeed, mulberry32, shuffle } from '../../game/rng'
import { Pix } from '../Pix'

const isPrime = (value: number) => value > 1 && Array.from({ length: Math.max(0, Math.floor(Math.sqrt(value)) - 1) }, (_, index) => index + 2).every(divisor => value % divisor !== 0)

export function LogicChallenges({ challenge, tier, seed, round, paused, onResult }: RuntimeProps) {
  const elapsed = usePausableClock(paused, 40)
  const model = useMemo(() => {
    const random = mulberry32(hashSeed(seed, round, challenge.id.length))
    const oddIndex = Math.floor(random() * 20)
    const order = shuffle(Array.from({ length: 4 + tier }, (_, index) => index + 1), random)
    const numbers = shuffle([2, 3, 4, 5, 6, 7, 9, 11, 12, 13].slice(0, 7 + tier), random)
    const sizes = shuffle([1, 2, 3, 4, 5].slice(0, 3 + tier), random)
    const colors = ['STEEL', 'AMBER', 'RED', 'GREEN'] as const
    const cssColors = ['#81929a', '#dda537', '#d64b3f', '#88a870']
    const wordIndex = Math.floor(random() * colors.length)
    let inkIndex = Math.floor(random() * colors.length)
    if (inkIndex === wordIndex) inkIndex = (inkIndex + 1) % colors.length
    return { oddIndex, order, numbers, sizes, colors, cssColors, wordIndex, inkIndex }
  }, [challenge.id, round, seed, tier])
  const [progress, setProgress] = useState(0)
  const [selected, setSelected] = useState<number[]>([])

  const tap = (callback: () => void) => (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    callback()
  }

  if (challenge.kind === 'odd-one-out') {
    return <div className={`odd-grid ${challenge.id === 'visual-noise' ? 'odd-grid--noise' : ''}`}>{Array.from({ length: 20 }, (_, index) => <button key={index} aria-label={`Sample ${index + 1}`} onPointerDown={tap(() => onResult(index === model.oddIndex ? success('ANOMALY VERIFIED', 1, `Sample ${index + 1}`, index + 1, { reactionMs: elapsed, completionTimeMs: elapsed }) : failure('SAMPLE CONSISTENT', `Anomaly was sample ${model.oddIndex + 1}.`)))}>{challenge.id === 'visual-noise' && index === model.oddIndex ? <Pix /> : index === model.oddIndex ? '◇' : '◆'}</button>)}</div>
  }

  if (challenge.kind === 'stroop') {
    const correct = model.colors[model.inkIndex]!
    return <div className="stroop-board"><p>DISPLAYED SAMPLE</p><b style={{ color: model.cssColors[model.inkIndex] }}>{model.colors[model.wordIndex]}</b><span>Select the <strong>ink color</strong>, not the word.</span><div>{model.colors.map((color, index) => <button key={color} style={{ '--swatch': model.cssColors[index] } as React.CSSProperties} onPointerDown={tap(() => onResult(color === correct ? success('ATTRIBUTE VERIFIED', 0.96, `Ink: ${correct}`, index, { completionTimeMs: elapsed }) : failure('ATTRIBUTE MISMATCH', `Ink was ${correct}.`)))}><i />{color}</button>)}</div></div>
  }

  if (challenge.kind === 'tap-order') {
    return <div className="order-board"><p>NEXT SAMPLE: {progress + 1}</p><div>{model.order.map(number => <button key={number} className={number <= progress ? 'done' : ''} onPointerDown={tap(() => {
      if (number !== progress + 1) onResult(failure('ORDER INVALID', `Expected ${progress + 1}; measured ${number}.`, undefined, { sequenceLength: progress }))
      else if (number === model.order.length) onResult(success('ORDER VERIFIED', 0.98, `${model.order.length} samples`, model.order.length, { sequenceLength: model.order.length, completionTimeMs: elapsed }))
      else setProgress(number)
    })}>{number > progress ? number : 'OK'}</button>)}</div></div>
  }

  if (challenge.kind === 'prime-tap') {
    const primes = model.numbers.filter(isPrime)
    const toggle = (number: number) => setSelected(values => values.includes(number) ? values.filter(value => value !== number) : [...values, number])
    return <div className="prime-board"><div>{model.numbers.map(number => <button key={number} aria-pressed={selected.includes(number)} className={selected.includes(number) ? 'selected' : ''} onPointerDown={tap(() => toggle(number))}>{number}</button>)}</div><button className="confirm-selection" onPointerDown={tap(() => {
      const valid = primes.length === selected.length && primes.every(value => selected.includes(value))
      onResult(valid ? success('PRIME FILTER VERIFIED', 1, `${primes.length} prime samples`, primes.length, { sequenceLength: primes.length, completionTimeMs: elapsed }) : failure('FILTER CONTAINS ERROR', `Prime samples: ${primes.join(', ')}`))
    })}>VERIFY SELECTION / {selected.length}</button></div>
  }

  if (challenge.kind === 'size-order') {
    return <div className="size-board"><p>NEXT SCALE: {progress + 1}</p><div>{model.sizes.map(size => <button key={size} className={size <= progress ? 'done' : ''} onPointerDown={tap(() => {
      if (size !== progress + 1) onResult(failure('SCALE ORDER INVALID', `Expected scale ${progress + 1}.`, undefined, { sequenceLength: progress }))
      else if (size === model.sizes.length) onResult(success('SCALE ORDER VERIFIED', 0.97, `${model.sizes.length} samples`, model.sizes.length, { sequenceLength: model.sizes.length, completionTimeMs: elapsed }))
      else setProgress(size)
    })}><i style={{ width: `${28 + size * 15}px`, height: `${28 + size * 15}px` }} /></button>)}</div></div>
  }

  if (challenge.kind === 'system-check') {
    return <div className="system-check"><div className="system-check__top"><Pix mood="panic" /><span>TOUCH INPUT DRIVER</span><b>OFFLINE</b></div><p>RECOVERY CONSOLE // ERROR HV-09-R</p><h2>SIGNAL INTERRUPTED</h2><div><button onPointerDown={tap(() => onResult(failure('RECOVERY PATH INVALID', 'Reboot was a simulated decoy.')))}>REBOOT</button><button className="restore" onPointerDown={tap(() => onResult(success('SYSTEM RESTORED', 1, 'Verified recovery path', undefined, { completionTimeMs: elapsed })))}>RESTORE SIGNAL</button><button onPointerDown={tap(() => onResult(failure('RECOVERY PATH INVALID', 'Clearing logs does not restore input.')))}>CLEAR LOGS</button></div></div>
  }

  return <div className="challenge-error">UNREGISTERED LOGIC TEST // {challenge.name}</div>
}
