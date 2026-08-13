import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../game/config'
import { calculateFinalScore, calculateLiveScore, getPrize, getScoreBand, sanitizeName, timingAccuracy } from '../game/engine/scoring'
import { resetSession } from '../storage/store'

describe('performance scoring', () => {
  it('keeps early runs far below the 99 club', () => {
    const result = { success: true, accuracy: 1, message: 'VERIFIED' }
    const session = { ...resetSession(3, 1), completed: 5, accuracyTotal: 5, combo: 5, bestCombo: 5, results: Array.from({ length: 5 }, () => result) }
    expect(calculateLiveScore(session)).toBeLessThan(50)
    expect(calculateFinalScore(session)).toBeLessThan(50)
  })

  it('allows an exceptional deep run to cross 99', () => {
    const result = { success: true, accuracy: 1, message: 'VERIFIED' }
    const session = { ...resetSession(3, 1), completed: 27, accuracyTotal: 27, combo: 20, bestCombo: 20, results: Array.from({ length: 27 }, () => result) }
    expect(calculateFinalScore(session)).toBeGreaterThanOrEqual(99)
  })

  it('uses configurable score bands and deterministic prize thresholds', () => {
    expect(getScoreBand(96, DEFAULT_SETTINGS.scoreBands)).toBe('TOUCH MASTER')
    expect(getPrize(96, DEFAULT_SETTINGS.prizeTiers)?.name).toBe('GOLD')
    expect(getPrize(79.99, DEFAULT_SETTINGS.prizeTiers)).toBeUndefined()
  })

  it('sanitizes school leaderboard names', () => {
    expect(sanitizeName('<b>ALEX</b>', DEFAULT_SETTINGS)).toBe('BALEXB')
    expect(sanitizeName('x', DEFAULT_SETTINGS)).toBe('PLAYER')
    expect(sanitizeName('badword kid', DEFAULT_SETTINGS)).toBe('PLAYER')
  })

  it('calculates timing accuracy from real error', () => {
    expect(timingAccuracy(0, 100)).toBe(1)
    expect(timingAccuracy(50, 100)).toBe(0.5)
    expect(timingAccuracy(150, 100)).toBe(0)
  })
})
