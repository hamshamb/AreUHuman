import { describe, expect, it } from 'vitest'
import { challengeTier, getEffectiveRound, selectChallenge } from '../game/engine/selection'
import { resetSession } from '../storage/store'

describe('adaptive challenge selection', () => {
  it('always starts with the basic tap onboarding', () => {
    expect(selectChallenge(resetSession(3, 100), 'hard').id).toBe('tap-circle')
  })

  it('accelerates exceptional players without changing prize thresholds', () => {
    const high = { ...resetSession(3, 3), completed: 10, accuracyTotal: 9.7, results: Array.from({ length: 10 }, () => ({ success: true, accuracy: 0.97, message: 'VERIFIED' })) }
    const low = { ...resetSession(3, 3), completed: 10, accuracyTotal: 4.5, results: Array.from({ length: 10 }, () => ({ success: true, accuracy: 0.45, message: 'VERIFIED' })) }
    expect(getEffectiveRound(high, 'medium')).toBeGreaterThan(getEffectiveRound(low, 'medium'))
  })

  it('does not repeat recently used challenges', () => {
    const session = { ...resetSession(3, 77), completed: 12, accuracyTotal: 10, recentChallengeIds: ['tap-circle', 'exact-hold', 'stop-needle', 'moving-target'] }
    expect(session.recentChallengeIds).not.toContain(selectChallenge(session, 'medium').id)
  })

  it('relaxes recency without selecting a challenge incompatible with an active rule', () => {
    const session = {
      ...resetSession(3, 77),
      failures: 1,
      recentChallengeIds: ['tap-circle', 'stop-needle', 'shrinking-target'],
      activeRules: [{ id: 'two-finger-third' as const, activatedAt: 0, expiresAt: 6 }],
    }
    const selected = selectChallenge(session, 'medium')

    expect(session.recentChallengeIds).toContain(selected.id)
    expect(selected.incompatibleRules ?? []).not.toContain('two-finger-third')
  })

  it('never relaxes the physical gesture constraint for NO REPEAT', () => {
    const session = {
      ...resetSession(3, 91),
      failures: 1,
      lastGesture: 'tap' as const,
      recentChallengeIds: ['exact-hold', 'stop-needle'],
      activeRules: [{ id: 'no-repeat' as const, activatedAt: 0, expiresAt: 5 }],
    }
    const selected = selectChallenge(session, 'medium')

    expect(session.recentChallengeIds).toContain(selected.id)
    expect(selected.gesture).not.toBe('tap')
  })

  it('moves through three visible tiers', () => {
    expect(challengeTier(2, 'medium')).toBe(1)
    expect(challengeTier(10, 'medium')).toBe(2)
    expect(challengeTier(19, 'medium')).toBe(3)
  })

  it('breaks category streaks when another hard-eligible category exists', () => {
    const session = { ...resetSession(3, 55), completed: 9, recentCategories: ['TIMING' as const, 'TIMING' as const] }
    expect(selectChallenge(session, 'medium').category).not.toBe('TIMING')
  })
})
