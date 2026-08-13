import { DEFAULT_SETTINGS } from '../game/config'
import type { ChallengeMetrics, ChallengeResult, ChallengeStats, GameSettings, LeaderboardEntry, PersistedData, PrizeTier, ScoreBand, SessionPerformance } from '../game/types'

const STORAGE_KEY = 'are-u-human:data:v1'
const PREVIOUS_STORAGE_KEY = 'human-verification:data:v1'
const LEGACY_STORAGE_KEY = 'touch-test-99:data:v1'

type UnknownRecord = Record<string, unknown>
export type LeaderboardComparable = Pick<LeaderboardEntry, 'score' | 'challenges' | 'durationMs'>

const asRecord = (value: unknown): UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
  ? value as UnknownRecord
  : {}

const boundedNumber = (value: unknown, fallback: number, minimum: number, maximum: number, integer = false): number => {
  const candidate = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  if (!Number.isFinite(candidate)) return fallback
  const bounded = Math.min(maximum, Math.max(minimum, candidate))
  return integer ? Math.round(bounded) : bounded
}

const booleanValue = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback
const stringValue = (value: unknown, fallback: string, maximumLength: number): string => typeof value === 'string' ? value.slice(0, maximumLength) : fallback

function normalizePrizeTiers(value: unknown): PrizeTier[] {
  const records = Array.isArray(value) ? value.map(asRecord) : []
  return DEFAULT_SETTINGS.prizeTiers.map(defaultTier => {
    const source = records.find(item => item.id === defaultTier.id) ?? {}
    return {
      id: defaultTier.id,
      name: stringValue(source.name, defaultTier.name, 32),
      threshold: boundedNumber(source.threshold, defaultTier.threshold, 0, 99.9),
      enabled: booleanValue(source.enabled, defaultTier.enabled),
    }
  })
}

function normalizeScoreBands(value: unknown): ScoreBand[] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.scoreBands.map(band => ({ ...band }))
  const bands = value.slice(0, 16).flatMap(item => {
    const source = asRecord(item)
    if (typeof source.label !== 'string' || !source.label.trim()) return []
    return [{
      threshold: boundedNumber(source.threshold, 0, 0, 100),
      label: source.label.slice(0, 40),
    }]
  })
  return bands.length ? bands : DEFAULT_SETTINGS.scoreBands.map(band => ({ ...band }))
}

function normalizeBlockedWords(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_SETTINGS.blockedWords]
  return [...new Set(value
    .filter((word): word is string => typeof word === 'string')
    .map(word => word.trim().slice(0, 32))
    .filter(Boolean))]
    .slice(0, 100)
}

export function normalizeSettings(value: unknown): GameSettings {
  const source = asRecord(value)
  const title = stringValue(source.title, DEFAULT_SETTINGS.title, 32)
  const rawPin = typeof source.adminPin === 'string' || typeof source.adminPin === 'number' ? String(source.adminPin) : DEFAULT_SETTINGS.adminPin
  const adminPin = rawPin.replace(/\D/g, '').slice(0, 8) || DEFAULT_SETTINGS.adminPin
  return {
    title: title === 'TOUCH TEST: 99%' || title === 'HUMAN VERIFICATION' ? DEFAULT_SETTINGS.title : title,
    tagline: stringValue(source.tagline, DEFAULT_SETTINGS.tagline, 80),
    smallCopy: stringValue(source.smallCopy, DEFAULT_SETTINGS.smallCopy, 80),
    gameEnabled: booleanValue(source.gameEnabled, DEFAULT_SETTINGS.gameEnabled),
    freePlay: booleanValue(source.freePlay, DEFAULT_SETTINGS.freePlay),
    credits: boundedNumber(source.credits, DEFAULT_SETTINGS.credits, 0, 9999, true),
    tokenLabel: stringValue(source.tokenLabel, DEFAULT_SETTINGS.tokenLabel, 24),
    tokenPriceText: stringValue(source.tokenPriceText, DEFAULT_SETTINGS.tokenPriceText, 48),
    attemptsPerCredit: boundedNumber(source.attemptsPerCredit, DEFAULT_SETTINGS.attemptsPerCredit, 1, 5, true),
    defaultLives: boundedNumber(source.defaultLives, DEFAULT_SETTINGS.defaultLives, 1, 5, true),
    difficulty: source.difficulty === 'easy' || source.difficulty === 'medium' || source.difficulty === 'hard' ? source.difficulty : DEFAULT_SETTINGS.difficulty,
    persistentRules: booleanValue(source.persistentRules, DEFAULT_SETTINGS.persistentRules),
    leaderboardEnabled: booleanValue(source.leaderboardEnabled, DEFAULT_SETTINGS.leaderboardEnabled),
    leaderboardLength: boundedNumber(source.leaderboardLength, DEFAULT_SETTINGS.leaderboardLength, 3, 50, true),
    prizeTiers: normalizePrizeTiers(source.prizeTiers),
    scoreBands: normalizeScoreBands(source.scoreBands),
    adminPin,
    blockedWords: normalizeBlockedWords(source.blockedWords),
    nameMaxLength: boundedNumber(source.nameMaxLength, DEFAULT_SETTINGS.nameMaxLength, 3, 16, true),
    attractTimeoutSeconds: boundedNumber(source.attractTimeoutSeconds, DEFAULT_SETTINGS.attractTimeoutSeconds, 10, 120, true),
    resultTimeoutSeconds: boundedNumber(source.resultTimeoutSeconds, DEFAULT_SETTINGS.resultTimeoutSeconds, 10, 120, true),
    masterVolume: boundedNumber(source.masterVolume, DEFAULT_SETTINGS.masterVolume, 0, 1),
    musicVolume: boundedNumber(source.musicVolume, DEFAULT_SETTINGS.musicVolume, 0, 1),
    sfxVolume: boundedNumber(source.sfxVolume, DEFAULT_SETTINGS.sfxVolume, 0, 1),
    muted: booleanValue(source.muted, DEFAULT_SETTINGS.muted),
    reducedMotion: booleanValue(source.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
    highContrast: booleanValue(source.highContrast, DEFAULT_SETTINGS.highContrast),
    showFps: booleanValue(source.showFps, DEFAULT_SETTINGS.showFps),
    touchVisualizer: booleanValue(source.touchVisualizer, DEFAULT_SETTINGS.touchVisualizer),
    screenScale: boundedNumber(source.screenScale, DEFAULT_SETTINGS.screenScale, 0.85, 1.15),
  }
}

export function createDefaultData(): PersistedData {
  return {
    version: 1,
    setupComplete: false,
    settings: normalizeSettings(DEFAULT_SETTINGS),
    leaderboard: [],
    challengeStats: {},
    totalPlays: 0,
    personalBest: 0,
    runDurations: [],
    diagnostics: [],
  }
}

export function loadData(): PersistedData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(PREVIOUS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return createDefaultData()
    const parsed = JSON.parse(raw) as Partial<PersistedData>
    if (parsed.version !== 1) return createDefaultData()
    return {
      ...createDefaultData(),
      ...parsed,
      settings: normalizeSettings(parsed.settings),
      leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : [],
      challengeStats: Object.fromEntries(Object.entries(parsed.challengeStats ?? {}).map(([id, stat]) => [id, normalizeChallengeStats(stat)])),
    }
  } catch {
    return createDefaultData()
  }
}

export function saveData(data: PersistedData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    localStorage.removeItem(PREVIOUS_STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // A full storage quota must never interrupt a live carnival run.
  }
}

export function compareLeaderboardEntries(a: LeaderboardComparable, b: LeaderboardComparable): number {
  return b.score - a.score || b.challenges - a.challenges || a.durationMs - b.durationMs
}

export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort(compareLeaderboardEntries)
}

export function todayEntries(entries: LeaderboardEntry[], now = new Date()): LeaderboardEntry[] {
  const day = now.toLocaleDateString('en-CA')
  return entries.filter(entry => new Date(entry.createdAt).toLocaleDateString('en-CA') === day)
}

export function recordChallenge(data: PersistedData, challengeId: string, result: ChallengeResult): PersistedData {
  const previous = normalizeChallengeStats(data.challengeStats[challengeId])
  const metricTotals = { ...previous.metricTotals }
  const metricCounts = { ...previous.metricCounts }
  for (const [key, value] of Object.entries(result.metrics ?? {}) as [keyof ChallengeMetrics, number][]) {
    if (!Number.isFinite(value)) continue
    metricTotals[key] = (metricTotals[key] ?? 0) + value
    metricCounts[key] = (metricCounts[key] ?? 0) + 1
  }
  return {
    ...data,
    challengeStats: {
      ...data.challengeStats,
      [challengeId]: {
        attempts: previous.attempts + 1,
        completions: previous.completions + (result.success ? 1 : 0),
        failures: previous.failures + (result.success ? 0 : 1),
        scoreTotal: previous.scoreTotal + result.accuracy,
        measurementTotal: previous.measurementTotal + (result.measurement ?? 0),
        measurementCount: previous.measurementCount + (result.measurement === undefined ? 0 : 1),
        metricTotals,
        metricCounts,
      },
    },
  }
}

export function resetSession(maxLives: number, seed = Date.now()): SessionPerformance {
  return {
    seed,
    startedAt: Date.now(),
    completed: 0,
    failures: 0,
    lives: maxLives,
    maxLives,
    combo: 0,
    bestCombo: 0,
    accuracyTotal: 0,
    recentChallengeIds: [],
    recentCategories: [],
    results: [],
    activeRules: [],
  }
}

export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(PREVIOUS_STORAGE_KEY)
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

function normalizeChallengeStats(value?: Partial<ChallengeStats>): ChallengeStats {
  return {
    attempts: value?.attempts ?? 0,
    completions: value?.completions ?? 0,
    failures: value?.failures ?? 0,
    scoreTotal: value?.scoreTotal ?? 0,
    measurementTotal: value?.measurementTotal ?? 0,
    measurementCount: value?.measurementCount ?? 0,
    metricTotals: value?.metricTotals ?? {},
    metricCounts: value?.metricCounts ?? {},
  }
}

export { LEGACY_STORAGE_KEY, PREVIOUS_STORAGE_KEY, STORAGE_KEY }
