import type { GameSettings, PrizeTier, ScoreBand, SessionPerformance } from '../types'

export function meanAccuracy(session: SessionPerformance): number {
  return session.results.length ? session.accuracyTotal / session.results.length : 0
}

export function calculateLiveScore(session: SessionPerformance): number {
  const depth = Math.min(90, session.completed * 3.75)
  const precision = meanAccuracy(session) * Math.min(8, session.completed * 0.4)
  const combo = Math.min(2, session.bestCombo * 0.12)
  const ceiling = session.completed < 8 ? 49 : session.completed < 16 ? 84.9 : session.completed < 24 ? 98.8 : 99.9
  return Math.min(ceiling, depth + precision + combo)
}

export function calculateFinalScore(session: SessionPerformance): number {
  const depth = Math.min(91, session.completed * 3.7)
  const precision = meanAccuracy(session) * 6.5
  const validLifeBudget = Number.isFinite(session.maxLives) && session.maxLives > 0
  const currentLives = Number.isFinite(session.lives) ? session.lives : 0
  const enduranceRatio = validLifeBudget ? Math.max(0, Math.min(1, currentLives / session.maxLives)) : 0
  const endurance = enduranceRatio * 1.5
  const combo = Math.min(1, session.bestCombo * 0.08)
  const ceiling = session.completed < 8 ? 49 : session.completed < 16 ? 84.9 : session.completed < 24 ? 98.8 : 99.9
  return Number(Math.min(ceiling, depth + precision + endurance + combo).toFixed(2))
}

export function getScoreBand(score: number, bands: ScoreBand[]): string {
  return [...bands]
    .sort((a, b) => b.threshold - a.threshold)
    .find(band => score >= band.threshold)?.label ?? 'NEEDS PRACTICE'
}

export function getPrize(score: number, tiers: PrizeTier[]): PrizeTier | undefined {
  return [...tiers]
    .filter(tier => tier.enabled && score >= tier.threshold)
    .sort((a, b) => b.threshold - a.threshold)[0]
}

export function sanitizeName(value: string, settings: GameSettings): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9 _-]/g, '').replace(/\s+/g, ' ').trim().slice(0, settings.nameMaxLength)
  const blocked = settings.blockedWords.some(word => clean.includes(word.toUpperCase()))
  return blocked || clean.length < 3 ? 'PLAYER' : clean
}

export function timingAccuracy(errorMs: number, toleranceMs: number): number {
  if (toleranceMs <= 0) return 0
  return Math.max(0, Math.min(1, 1 - Math.abs(errorMs) / toleranceMs))
}

export function closestMeasuredMiss(session: SessionPerformance): string | undefined {
  return session.results
    .filter(result => !result.success && result.detail && Number.isFinite(result.normalizedMiss))
    .sort((a, b) => (a.normalizedMiss ?? Number.POSITIVE_INFINITY) - (b.normalizedMiss ?? Number.POSITIVE_INFINITY))[0]?.detail
}
