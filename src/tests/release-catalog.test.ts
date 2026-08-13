import { describe, expect, it } from 'vitest'
import { CHALLENGES } from '../game/challenges/catalog'
import { registeredChallenges, resolveChallengeRuntime } from '../game/challenges/registry'
import { MAX_ROUNDS } from '../game/config'
import { RULES } from '../game/rules/rules'

const TIER_KEYS = ['easy', 'hard', 'medium']

describe('release catalog invariants', () => {
  it('keeps all 54 registry entries complete, bounded, and runtime-resolvable', () => {
    const errors: string[] = []
    const ids = new Set<string>()
    const runtimeByKind = new Map<string, string>()
    const knownRules = new Set(Object.keys(RULES))

    for (const challenge of CHALLENGES) {
      const prefix = challenge.id || '<missing-id>'
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(challenge.id)) errors.push(`${prefix}: id is not kebab-case`)
      if (ids.has(challenge.id)) errors.push(`${prefix}: duplicate id`)
      ids.add(challenge.id)

      if (!challenge.name.trim()) errors.push(`${prefix}: missing name`)
      if (!challenge.variant.trim() || challenge.variant !== challenge.variant.toUpperCase()) errors.push(`${prefix}: invalid variant`)
      if (!challenge.instruction.trim()) errors.push(`${prefix}: missing instruction`)
      if (challenge.instruction.trim().split(/\s+/).length > 8) errors.push(`${prefix}: instruction exceeds eight words`)
      if (challenge.accessibility.trim().length < 20) errors.push(`${prefix}: accessibility copy is too short`)
      if (!Number.isInteger(challenge.minRound) || challenge.minRound < 0 || challenge.minRound > MAX_ROUNDS) errors.push(`${prefix}: invalid minimum round`)
      if (!Number.isFinite(challenge.timeLimit) || challenge.timeLimit < 5) errors.push(`${prefix}: invalid time limit`)
      if (!Number.isFinite(challenge.expectedDuration) || challenge.expectedDuration < 3 || challenge.expectedDuration > challenge.timeLimit) errors.push(`${prefix}: invalid expected duration`)

      const { min, max } = challenge.pointerRequirement
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min || max > 5) errors.push(`${prefix}: invalid pointer range`)
      if (challenge.gesture === 'inhibition' && (min !== 0 || max !== 0)) errors.push(`${prefix}: inhibition must require zero pointers`)
      if (challenge.gesture === 'multi-touch' && (min < 2 || max < 2)) errors.push(`${prefix}: multi-touch must allow at least two pointers`)
      if (challenge.gesture !== 'inhibition' && challenge.gesture !== 'multi-touch' && min < 1) errors.push(`${prefix}: active gesture requires a pointer`)

      const previousRuntime = runtimeByKind.get(challenge.kind)
      if (previousRuntime && previousRuntime !== challenge.runtime) errors.push(`${prefix}: kind crosses runtime groups`)
      runtimeByKind.set(challenge.kind, challenge.runtime)
      if (resolveChallengeRuntime(challenge) !== challenge.runtime) errors.push(`${prefix}: registry runtime mismatch`)

      const incompatible = challenge.incompatibleRules ?? []
      if (new Set(incompatible).size !== incompatible.length) errors.push(`${prefix}: duplicate incompatible rule`)
      for (const ruleId of incompatible) {
        if (!knownRules.has(ruleId)) errors.push(`${prefix}: unknown incompatible rule ${ruleId}`)
      }

      for (const [key, value] of Object.entries(challenge.tuning ?? {})) {
        if (typeof value === 'number') {
          if (!Number.isFinite(value)) errors.push(`${prefix}: ${key} is not finite`)
          continue
        }
        if (!value || typeof value !== 'object') {
          errors.push(`${prefix}: ${key} has an invalid tuning value`)
          continue
        }
        if (Object.keys(value).sort().join(',') !== TIER_KEYS.join(',')) errors.push(`${prefix}: ${key} is missing a difficulty tier`)
        if (Object.values(value).some(tierValue => typeof tierValue !== 'number' || !Number.isFinite(tierValue))) errors.push(`${prefix}: ${key} contains a non-finite tier`)
      }

      const requiredPointers = challenge.tuning?.requiredPointers
      if (requiredPointers !== undefined && (requiredPointers < min || requiredPointers > max)) errors.push(`${prefix}: tuned pointer count is outside declared range`)
    }

    expect(CHALLENGES).toHaveLength(54)
    expect(registeredChallenges().map(challenge => challenge.id)).toEqual(CHALLENGES.map(challenge => challenge.id))
    expect(new Set(CHALLENGES.map(challenge => challenge.runtime))).toEqual(new Set(['interaction', 'memory', 'logic']))
    expect(errors).toEqual([])
  })
})
