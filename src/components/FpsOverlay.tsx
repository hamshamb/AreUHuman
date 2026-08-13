import { useEffect, useState } from 'react'

export function FpsOverlay({ pointers, challenge, difficulty, rules }: { pointers: number; challenge: string; difficulty: string; rules: string[] }) {
  const [fps, setFps] = useState(60)
  useEffect(() => {
    let frames = 0
    let previous = performance.now()
    let raf = 0
    const tick = (now: number) => {
      frames += 1
      if (now - previous >= 1000) { setFps(Math.round(frames * 1000 / (now - previous))); frames = 0; previous = now }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <aside className="debug-overlay"><b>{fps} FPS</b><span>POINTERS {pointers}</span><span>{challenge}</span><span>{difficulty}</span><span>{rules.join(' / ') || 'NO RULES'}</span></aside>
}
