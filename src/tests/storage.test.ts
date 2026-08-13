import { describe, expect, it } from 'vitest'
import { createDefaultData, LEGACY_STORAGE_KEY, loadData, PREVIOUS_STORAGE_KEY, recordChallenge, resetSession, saveData, sortLeaderboard, STORAGE_KEY, todayEntries } from '../storage/store'

describe('versioned local persistence', () => {
  it('round-trips operator configuration', () => {
    const data = createDefaultData()
    data.settings.title = 'CARNIVAL TOUCH'
    saveData(data)
    expect(loadData().settings.title).toBe('CARNIVAL TOUCH')
  })

  it('recovers safely from malformed storage', () => {
    localStorage.setItem(STORAGE_KEY, '{broken')
    expect(loadData().settings.title).toBe('AreUHuman')
  })

  it('migrates legacy scores and the former default title', () => {
    const legacy = createDefaultData()
    legacy.settings.title = 'TOUCH TEST: 99%'
    legacy.totalPlays = 12
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy))
    expect(loadData()).toMatchObject({ totalPlays: 12, settings: { title: 'AreUHuman' } })
  })

  it('migrates the previous product storage key and default title', () => {
    const previous = createDefaultData()
    previous.settings.title = 'HUMAN VERIFICATION'
    previous.totalPlays = 7
    localStorage.setItem(PREVIOUS_STORAGE_KEY, JSON.stringify(previous))
    expect(loadData()).toMatchObject({ totalPlays: 7, settings: { title: 'AreUHuman' } })
  })

  it('sorts leaderboard scores with fair tie breakers', () => {
    const base = { createdAt: new Date().toISOString(), bestCombo: 1, precision: 0.8, durationMs: 30000 }
    const sorted = sortLeaderboard([
      { ...base, id: 'a', name: 'A', score: 90, challenges: 12 },
      { ...base, id: 'b', name: 'B', score: 95, challenges: 10 },
      { ...base, id: 'c', name: 'C', score: 90, challenges: 14 },
    ])
    expect(sorted.map(entry => entry.id)).toEqual(['b', 'c', 'a'])
    expect(todayEntries(sorted)).toHaveLength(3)
  })

  it('records attempts and resets session state between players', () => {
    const updated = recordChallenge(createDefaultData(), 'tap-circle', { success: true, accuracy: 0.9, message: 'CLEAN' })
    expect(updated.challengeStats['tap-circle']?.completions).toBe(1)
    const session = resetSession(4, 123)
    expect(session).toMatchObject({ lives: 4, completed: 0, failures: 0, activeRules: [], recentChallengeIds: [] })
  })
})
