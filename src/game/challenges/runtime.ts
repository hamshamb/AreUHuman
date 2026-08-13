import { useEffect, useRef, useState } from 'react'
import type { ActiveRule, ChallengeDefinition, ChallengeMetrics, ChallengeResult } from '../types'

export interface RuntimeProps {
  challenge: ChallengeDefinition
  tier: 1 | 2 | 3
  seed: number
  round: number
  activeRules: ActiveRule[]
  paused: boolean
  onResult: (result: ChallengeResult) => void
}

export function success(message: string, accuracy = 0.8, detail?: string, measurement?: number, metrics?: ChallengeMetrics): ChallengeResult {
  return { success: true, message, accuracy: Math.max(0, Math.min(1, accuracy)), detail, measurement, metrics, normalizedMiss: 0 }
}

export function failure(message: string, detail?: string, measurement?: number, metrics?: ChallengeMetrics, normalizedMiss = 1): ChallengeResult {
  return { success: false, message, accuracy: 0, detail, measurement, metrics, normalizedMiss: Math.max(0, normalizedMiss) }
}

export function tierValue(values: { easy: number; medium: number; hard: number } | undefined, tier: 1 | 2 | 3, fallback: number): number {
  if (!values) return fallback
  return tier === 1 ? values.easy : tier === 2 ? values.medium : values.hard
}

export function usePausableClock(paused: boolean, interval = 25): number {
  const [elapsed, setElapsed] = useState(0)
  const previous = useRef(performance.now())
  useEffect(() => {
    previous.current = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const delta = now - previous.current
      previous.current = now
      if (!paused) setElapsed(value => value + delta)
    }, interval)
    return () => window.clearInterval(timer)
  }, [interval, paused])
  return elapsed
}
