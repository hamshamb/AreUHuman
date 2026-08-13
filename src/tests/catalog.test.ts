import { describe, expect, it } from 'vitest'
import { CHALLENGES, getChallenge } from '../game/challenges/catalog'
import { registeredChallenges, validateChallengeRegistry } from '../game/challenges/registry'
import { isRuleCompatible } from '../game/rules/rules'

describe('production challenge catalog', () => {
  it('contains fifty-four registered variants across forty-four mechanics', () => {
    expect(CHALLENGES).toHaveLength(54)
    expect(new Set(CHALLENGES.map(challenge => challenge.id)).size).toBe(54)
    expect(new Set(CHALLENGES.map(challenge => challenge.kind)).size).toBe(44)
    expect(registeredChallenges()).toHaveLength(54)
    expect(validateChallengeRegistry()).toEqual([])
  })

  it('keeps instructions spectator-readable and accessible', () => {
    CHALLENGES.forEach(challenge => {
      expect(challenge.instruction.split(/\s+/).length).toBeLessThanOrEqual(8)
      expect(challenge.accessibility.length).toBeGreaterThan(20)
      expect(challenge.timeLimit).toBeGreaterThanOrEqual(5)
      expect(challenge.expectedDuration).toBeLessThanOrEqual(challenge.timeLimit)
      expect(challenge.pointerRequirement.max).toBeGreaterThanOrEqual(challenge.pointerRequirement.min)
    })
  })

  it('excludes screen-sector rules from fixed left-origin mechanics', () => {
    for (const id of ['trace-wave', 'safe-path', 'moving-path', 'precision-drop']) {
      const challenge = getChallenge(id)
      expect(challenge, `${id} must remain registered`).toBeDefined()
      if (!challenge) continue
      expect(challenge.incompatibleRules).toEqual(expect.arrayContaining(['alternate-sector', 'central-contact']))
      expect(isRuleCompatible('alternate-sector', [], challenge)).toBe(false)
      expect(isRuleCompatible('central-contact', [], challenge)).toBe(false)
    }
  })
})
