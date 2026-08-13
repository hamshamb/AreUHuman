import { CHALLENGES } from '../challenges/catalog'
import { DIFFICULTY_MULTIPLIER } from '../config'
import { mulberry32, pick } from '../rng'
import { hasRule, isRuleCompatible } from '../rules/rules'
import type { ChallengeDefinition, Difficulty, SessionPerformance } from '../types'

export function getEffectiveRound(session: SessionPerformance, difficulty: Difficulty): number {
  const accuracy = session.results.length ? session.accuracyTotal / session.results.length : 0.7
  const adaptive = accuracy > 0.88 ? 2 : accuracy < 0.55 ? -1 : 0
  return Math.max(0, Math.floor((session.completed + adaptive) * DIFFICULTY_MULTIPLIER[difficulty]))
}

export function selectChallenge(session: SessionPerformance, difficulty: Difficulty): ChallengeDefinition {
  const effectiveRound = getEffectiveRound(session, difficulty)
  const recent = new Set(session.recentChallengeIds.slice(-7))
  const noRepeat = hasRule(session.activeRules, 'no-repeat')
  const eligible = CHALLENGES.filter(challenge => {
    if (challenge.minRound > effectiveRound + 2) return false
    if (noRepeat && challenge.gesture === session.lastGesture) return false
    return session.activeRules.every(rule => isRuleCompatible(rule.id, session.activeRules.filter(item => item.id !== rule.id), challenge))
  })

  if (!eligible.length) throw new Error('No challenge satisfies the active rules')

  const onboarding = CHALLENGES[0]!
  if (session.completed === 0 && session.failures === 0 && eligible.includes(onboarding)) return onboarding

  const notRecent = eligible.filter(challenge => !recent.has(challenge.id))
  const recencyPool = notRecent.length ? notRecent : eligible
  const repeatedCategory = session.recentCategories.length >= 2 && session.recentCategories.at(-1) === session.recentCategories.at(-2)
    ? session.recentCategories.at(-1)
    : undefined
  const categoryVariety = repeatedCategory ? recencyPool.filter(challenge => challenge.category !== repeatedCategory) : recencyPool
  const candidates = categoryVariety.length ? categoryVariety : recencyPool
  return pick(candidates, mulberry32(session.seed ^ (session.completed + session.failures + 1) * 7919))
}

export function challengeTier(round: number, difficulty: Difficulty): 1 | 2 | 3 {
  const offset = difficulty === 'easy' ? -2 : difficulty === 'hard' ? 3 : 0
  const adjusted = round + offset
  if (adjusted < 7) return 1
  if (adjusted < 15) return 2
  return 3
}
