import { describe, expect, it } from 'vitest'
import { CHALLENGES } from '../game/challenges/catalog'
import { selectChallenge } from '../game/engine/selection'
import { expireRules, isRuleCompatible, maybeAddRule, RULES } from '../game/rules/rules'
import type { ActiveRule, RuleId } from '../game/types'
import { resetSession } from '../storage/store'

const RULE_IDS = Object.keys(RULES) as RuleId[]
const active = (id: RuleId, activatedAt = 19): ActiveRule => ({
  id,
  activatedAt,
  expiresAt: activatedAt + RULES[id].duration,
})

describe('release persistent-rule matrix', () => {
  it('defines twelve coherent rules with symmetric pair conflicts', () => {
    const errors: string[] = []

    for (const id of RULE_IDS) {
      const definition = RULES[id]
      if (definition.id !== id) errors.push(`${id}: definition id mismatch`)
      if (!definition.name.trim() || !definition.short.trim()) errors.push(`${id}: missing operator copy`)
      if (!Number.isInteger(definition.duration) || definition.duration < 1) errors.push(`${id}: invalid duration`)
      if (!Number.isInteger(definition.difficulty) || definition.difficulty < 1 || definition.difficulty > 3) errors.push(`${id}: invalid difficulty`)
      if (new Set(definition.incompatible).size !== definition.incompatible.length) errors.push(`${id}: duplicate conflict`)

      for (const otherId of RULE_IDS) {
        const expectedConflict = id === otherId
          || definition.incompatible.includes(otherId)
          || RULES[otherId].incompatible.includes(id)
        const compatibleForward = isRuleCompatible(id, [active(otherId)])
        const compatibleReverse = isRuleCompatible(otherId, [active(id)])
        if (compatibleForward !== !expectedConflict) errors.push(`${id} + ${otherId}: forward conflict mismatch`)
        if (compatibleReverse !== !expectedConflict) errors.push(`${id} + ${otherId}: reverse conflict mismatch`)
      }
    }

    expect(RULE_IDS).toHaveLength(12)
    expect(new Set(RULE_IDS).size).toBe(12)
    expect(errors).toEqual([])
  })

  it('evaluates every rule against every registered challenge and leaves a valid candidate', () => {
    const errors: string[] = []

    for (const [ruleIndex, id] of RULE_IDS.entries()) {
      const definition = RULES[id]
      const compatibleCandidates = []

      for (const challenge of CHALLENGES) {
        const expectedCompatible = !challenge.incompatibleRules?.includes(id)
          && !definition.incompatibleGestures?.includes(challenge.gesture)
          && !(id === 'single-contact' && challenge.pointerRequirement.max > 1)
          && !(id === 'two-finger-third' && challenge.pointerRequirement.max === 0)
        const actualCompatible = isRuleCompatible(id, [], challenge)

        if (actualCompatible !== expectedCompatible) errors.push(`${id} + ${challenge.id}: compatibility mismatch`)
        if (actualCompatible) compatibleCandidates.push(challenge)
      }

      if (!compatibleCandidates.length) {
        errors.push(`${id}: no compatible challenge candidate`)
        continue
      }

      const session = {
        ...resetSession(3, 90_000 + ruleIndex),
        completed: 24,
        activeRules: [active(id)],
      }
      const selected = selectChallenge(session, 'hard')
      if (!compatibleCandidates.some(challenge => challenge.id === selected.id)) errors.push(`${id}: selector returned incompatible ${selected.id}`)
    }

    expect(CHALLENGES).toHaveLength(54)
    expect(errors).toEqual([])
  })

  it('can deterministically activate and expire every rule at its exact boundary', () => {
    const firstActivation = new Map<RuleId, ActiveRule>()
    const activationRound = 19

    for (let seed = 0; seed < 4096 && firstActivation.size < RULE_IDS.length; seed += 1) {
      const added = maybeAddRule([], activationRound, seed)
      const rule = added[0]
      if (rule && !firstActivation.has(rule.id)) firstActivation.set(rule.id, rule)
    }

    expect([...firstActivation.keys()].sort()).toEqual([...RULE_IDS].sort())

    for (const id of RULE_IDS) {
      const activated = firstActivation.get(id)
      expect(activated, `${id} was not reachable through seeded activation`).toBeDefined()
      if (!activated) continue

      expect(activated.activatedAt).toBe(activationRound)
      expect(activated.expiresAt).toBe(activationRound + RULES[id].duration)
      expect(expireRules([activated], activated.expiresAt - 1)).toEqual([activated])
      expect(expireRules([activated], activated.expiresAt)).toEqual([])

      if (id === 'remember-star') {
        expect(activated.memoryValue).toBeGreaterThanOrEqual(2)
        expect(activated.memoryValue).toBeLessThanOrEqual(9)
      } else {
        expect(activated.memoryValue).toBeUndefined()
      }
    }
  })
})
