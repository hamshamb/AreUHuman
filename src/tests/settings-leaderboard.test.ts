import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../game/config'
import {
  compareLeaderboardEntries,
  createDefaultData,
  loadData,
  normalizeSettings,
  sortLeaderboard,
  STORAGE_KEY,
} from '../storage/store'

describe('operator settings normalization', () => {
  it('clamps live operator patches and repairs invalid scalar or nested values', () => {
    const normalized = normalizeSettings({
      ...DEFAULT_SETTINGS,
      title: 'X'.repeat(80),
      credits: -80,
      attemptsPerCredit: 99,
      defaultLives: 0,
      difficulty: 'impossible',
      leaderboardLength: 500,
      nameMaxLength: 1,
      attractTimeoutSeconds: 3,
      resultTimeoutSeconds: 600,
      masterVolume: -2,
      musicVolume: 4,
      sfxVolume: Number.NaN,
      screenScale: 9,
      adminPin: 'A1-2B3',
      blockedWords: ['  BAD  ', 'BAD', 42, '', 'X'.repeat(50)],
      prizeTiers: [{ id: 'gold', name: 'G'.repeat(50), threshold: -20, enabled: 'yes' }],
      scoreBands: [{ threshold: 140, label: 'OUT OF RANGE' }, { threshold: 'bad', label: '' }],
    })

    expect(normalized).toMatchObject({
      credits: 0,
      attemptsPerCredit: 5,
      defaultLives: 1,
      difficulty: 'medium',
      leaderboardLength: 50,
      nameMaxLength: 3,
      attractTimeoutSeconds: 10,
      resultTimeoutSeconds: 120,
      masterVolume: 0,
      musicVolume: 1,
      sfxVolume: DEFAULT_SETTINGS.sfxVolume,
      screenScale: 1.15,
      adminPin: '123',
      blockedWords: ['BAD', 'X'.repeat(32)],
    })
    expect(normalized.title).toHaveLength(32)
    expect(normalized.prizeTiers).toHaveLength(DEFAULT_SETTINGS.prizeTiers.length)
    expect(normalized.prizeTiers.find(tier => tier.id === 'gold')).toEqual({ id: 'gold', name: 'G'.repeat(32), threshold: 0, enabled: true })
    expect(normalized.scoreBands).toEqual([{ threshold: 100, label: 'OUT OF RANGE' }])
  })

  it('normalizes partial and corrupt persisted settings while retaining valid legacy values', () => {
    const persisted = {
      ...createDefaultData(),
      setupComplete: true,
      settings: {
        title: 'TOUCH TEST: 99%',
        tagline: 'LEGACY TAGLINE',
        credits: '12',
        defaultLives: -7,
        difficulty: 'nightmare',
        muted: 'false',
        screenScale: null,
        prizeTiers: 'corrupt',
        blockedWords: null,
      },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))

    const loaded = loadData()
    expect(loaded.settings.title).toBe(DEFAULT_SETTINGS.title)
    expect(loaded.settings.tagline).toBe('LEGACY TAGLINE')
    expect(loaded.settings.credits).toBe(12)
    expect(loaded.settings.defaultLives).toBe(1)
    expect(loaded.settings.difficulty).toBe(DEFAULT_SETTINGS.difficulty)
    expect(loaded.settings.muted).toBe(DEFAULT_SETTINGS.muted)
    expect(loaded.settings.screenScale).toBe(DEFAULT_SETTINGS.screenScale)
    expect(loaded.settings.prizeTiers).toEqual(DEFAULT_SETTINGS.prizeTiers)
    expect(loaded.settings.blockedWords).toEqual(DEFAULT_SETTINGS.blockedWords)
    expect(loaded.settings.resultTimeoutSeconds).toBe(DEFAULT_SETTINGS.resultTimeoutSeconds)
  })
})

describe('leaderboard comparator', () => {
  it('uses score, completed challenges, then duration for ordering and qualification ties', () => {
    const base = {
      createdAt: '2026-08-12T12:00:00.000Z',
      bestCombo: 1,
      precision: 0.9,
    }
    const entries = [
      { ...base, id: 'slow', name: 'SLOW', score: 95, challenges: 12, durationMs: 40_000 },
      { ...base, id: 'shallow', name: 'SHALLOW', score: 95, challenges: 10, durationMs: 10_000 },
      { ...base, id: 'fast', name: 'FAST', score: 95, challenges: 12, durationMs: 25_000 },
      { ...base, id: 'score', name: 'SCORE', score: 96, challenges: 1, durationMs: 90_000 },
    ]

    expect(sortLeaderboard(entries).map(entry => entry.id)).toEqual(['score', 'fast', 'slow', 'shallow'])

    const cutoff = entries[0]!
    const qualifyingTie = { score: 95, challenges: 12, durationMs: 30_000 }
    const shallowTie = { score: 95, challenges: 11, durationMs: 1_000 }
    expect(compareLeaderboardEntries(qualifyingTie, cutoff)).toBeLessThan(0)
    expect(compareLeaderboardEntries(shallowTie, cutoff)).toBeGreaterThan(0)
    expect(compareLeaderboardEntries({ score: 95, challenges: 12, durationMs: 40_000 }, cutoff)).toBe(0)
  })
})
