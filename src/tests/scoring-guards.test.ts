import { describe, expect, it } from 'vitest'
import { calculateFinalScore } from '../game/engine/scoring'
import { resetSession } from '../storage/store'

describe('scoring input guards', () => {
  it('treats non-positive or invalid maximum lives as zero endurance', () => {
    const baseline = { ...resetSession(1, 3), completed: 10, lives: 0, maxLives: 1 }
    const expected = calculateFinalScore(baseline)

    for (const maxLives of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const score = calculateFinalScore({ ...baseline, lives: 50, maxLives })
      expect(Number.isFinite(score)).toBe(true)
      expect(score).toBe(expected)
    }
  })

  it('clamps endurance to the valid zero-to-one range', () => {
    const session = { ...resetSession(3, 4), completed: 10 }
    expect(calculateFinalScore({ ...session, lives: 99 })).toBe(calculateFinalScore({ ...session, lives: 3 }))
    expect(calculateFinalScore({ ...session, lives: -99 })).toBe(calculateFinalScore({ ...session, lives: 0 }))
    expect(calculateFinalScore({ ...session, lives: Number.NaN })).toBe(calculateFinalScore({ ...session, lives: 0 }))
  })
})
