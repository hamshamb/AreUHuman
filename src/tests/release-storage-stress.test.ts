import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHALLENGES } from '../game/challenges/catalog'
import type { ChallengeMetrics, ChallengeResult, ChallengeStats, LeaderboardEntry, RuleId, SessionPerformance } from '../game/types'
import { createDefaultData, loadData, recordChallenge, resetSession, saveData } from '../storage/store'

const CYCLES = 200

const emptyExpectedStats = (): ChallengeStats => ({
  attempts: 0,
  completions: 0,
  failures: 0,
  scoreTotal: 0,
  measurementTotal: 0,
  measurementCount: 0,
  metricTotals: {},
  metricCounts: {},
})

afterEach(() => vi.useRealTimers())

describe('release session and persistence stress', () => {
  it('round-trips 200 isolated player cycles without state or metric leakage', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T12:00:00.000Z'))

    let data = createDefaultData()
    let previousSession: SessionPerformance | undefined
    const expectedByChallenge = new Map<string, ChallengeStats>()
    const ruleIds: RuleId[] = ['avoid-red', 'remember-star', 'protect-pix', 'central-contact']

    for (let cycle = 0; cycle < CYCLES; cycle += 1) {
      const maxLives = 1 + (cycle % 5)
      const session = resetSession(maxLives, 10_000 + cycle)

      expect(session).toMatchObject({
        seed: 10_000 + cycle,
        completed: 0,
        failures: 0,
        lives: maxLives,
        maxLives,
        combo: 0,
        bestCombo: 0,
        accuracyTotal: 0,
      })
      expect(session.results).toEqual([])
      expect(session.activeRules).toEqual([])
      expect(session.recentChallengeIds).toEqual([])
      expect(session.recentCategories).toEqual([])

      if (previousSession) {
        expect(session.results).not.toBe(previousSession.results)
        expect(session.activeRules).not.toBe(previousSession.activeRules)
        expect(session.recentChallengeIds).not.toBe(previousSession.recentChallengeIds)
        expect(session.recentCategories).not.toBe(previousSession.recentCategories)
      }

      const challenge = CHALLENGES[cycle % CHALLENGES.length]!
      const success = cycle % 4 !== 0
      const accuracy = ((cycle * 37) % 101) / 100
      const measurement = cycle % 5 === 0 ? undefined : ((cycle * 13) % 997) + 0.25
      const metrics: ChallengeMetrics = {
        reactionMs: 110 + (cycle % 47),
        precisionErrorPx: (cycle % 17) * 0.5,
        pointerCount: challenge.pointerRequirement.min,
        ...(cycle % 3 === 0 ? { timingErrorMs: cycle % 89 } : {}),
      }
      const result: ChallengeResult = {
        success,
        accuracy,
        message: success ? 'VERIFIED' : 'INPUT INVALID',
        measurement,
        durationMs: 900 + cycle,
        metrics,
      }

      session.results.push(result)
      session.activeRules.push({ id: ruleIds[cycle % ruleIds.length]!, activatedAt: cycle, expiresAt: cycle + 4 })
      session.recentChallengeIds.push(challenge.id)
      session.recentCategories.push(challenge.category)
      session.completed = success ? 1 : 0
      session.failures = success ? 0 : 1
      session.lives = success ? maxLives : maxLives - 1
      previousSession = session

      const beforeStats = data.challengeStats[challenge.id]
      const recorded = recordChallenge(data, challenge.id, result)
      expect(recorded).not.toBe(data)
      expect(data.challengeStats[challenge.id]).toBe(beforeStats)

      const expected = expectedByChallenge.get(challenge.id) ?? emptyExpectedStats()
      expected.attempts += 1
      expected.completions += success ? 1 : 0
      expected.failures += success ? 0 : 1
      expected.scoreTotal += accuracy
      if (measurement !== undefined) {
        expected.measurementTotal += measurement
        expected.measurementCount += 1
      }
      for (const [key, value] of Object.entries(metrics) as [keyof ChallengeMetrics, number][]) {
        expected.metricTotals[key] = (expected.metricTotals[key] ?? 0) + value
        expected.metricCounts[key] = (expected.metricCounts[key] ?? 0) + 1
      }
      expectedByChallenge.set(challenge.id, expected)

      const score = Math.round(accuracy * 10_000) / 100
      const leaderboardEntry: LeaderboardEntry = {
        id: `stress-${String(cycle).padStart(3, '0')}`,
        name: `P${String(cycle).padStart(3, '0')}`,
        score,
        createdAt: new Date(Date.UTC(2026, 7, 12, 12, 0, cycle)).toISOString(),
        challenges: 1,
        bestCombo: success ? 1 : 0,
        precision: accuracy,
        durationMs: 900 + cycle,
      }
      const next = {
        ...recorded,
        totalPlays: cycle + 1,
        personalBest: Math.max(recorded.personalBest, score),
        leaderboard: [...recorded.leaderboard, leaderboardEntry],
        runDurations: [...recorded.runDurations.slice(-199), 900 + cycle],
        diagnostics: [...recorded.diagnostics.slice(-31), `cycle:${cycle}:${challenge.id}`],
      }

      saveData(next)
      const loaded = loadData()
      expect(loaded.totalPlays).toBe(cycle + 1)
      expect(loaded.challengeStats[challenge.id]).toEqual(next.challengeStats[challenge.id])
      expect(loaded.leaderboard.at(-1)).toEqual(leaderboardEntry)
      data = loaded
    }

    expect(data.totalPlays).toBe(CYCLES)
    expect(data.leaderboard).toHaveLength(CYCLES)
    expect(data.runDurations).toHaveLength(CYCLES)
    expect(data.diagnostics).toHaveLength(32)
    expect(Object.keys(data.challengeStats)).toHaveLength(CHALLENGES.length)

    for (const [challengeId, expected] of expectedByChallenge) {
      const actual = data.challengeStats[challengeId]
      expect(actual, `${challengeId} stats were not persisted`).toBeDefined()
      if (!actual) continue
      expect(actual.attempts).toBe(expected.attempts)
      expect(actual.completions).toBe(expected.completions)
      expect(actual.failures).toBe(expected.failures)
      expect(actual.scoreTotal).toBeCloseTo(expected.scoreTotal, 10)
      expect(actual.measurementTotal).toBeCloseTo(expected.measurementTotal, 10)
      expect(actual.measurementCount).toBe(expected.measurementCount)
      expect(actual.metricTotals).toEqual(expected.metricTotals)
      expect(actual.metricCounts).toEqual(expected.metricCounts)
    }

    const finalRoundTrip = loadData()
    expect(finalRoundTrip).toEqual(data)

    const cleanSession = resetSession(3, 999_999)
    expect(cleanSession.results).toEqual([])
    expect(cleanSession.activeRules).toEqual([])
    expect(cleanSession.recentChallengeIds).toEqual([])
    expect(cleanSession.recentCategories).toEqual([])
    expect(cleanSession.results).not.toBe(previousSession?.results)
  })
})
