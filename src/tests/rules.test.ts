import { describe, expect, it } from 'vitest'
import { expireRules, isRuleCompatible, maybeAddRule, requiredStartSector, requiresTwoFingers, validatePointerDownRules } from '../game/rules/rules'
import type { ActiveRule } from '../game/types'

const active = (id: ActiveRule['id'], expiresAt = 20): ActiveRule => ({ id, activatedAt: 7, expiresAt })

describe('persistent rule engine', () => {
  it('rejects declared conflicts in either direction', () => {
    expect(isRuleCompatible('no-repeat', [active('two-finger-third')])).toBe(false)
    expect(isRuleCompatible('two-finger-third', [active('no-repeat')])).toBe(false)
    expect(isRuleCompatible('protect-pix', [active('no-repeat')])).toBe(true)
  })

  it('expires rules at their exact round boundary', () => {
    expect(expireRules([active('avoid-red', 9), active('protect-pix', 10)], 9).map(rule => rule.id)).toEqual(['protect-pix'])
  })

  it('adds rules only at escalation milestones', () => {
    expect(maybeAddRule([], 6, 42)).toHaveLength(0)
    expect(maybeAddRule([], 7, 42)).toHaveLength(1)
  })

  it('requires two fingers on every third validated action', () => {
    const rules = [active('two-finger-third')]
    expect(requiresTwoFingers(rules, 1)).toBe(false)
    expect(requiresTwoFingers(rules, 2)).toBe(true)
    expect(requiresTwoFingers(rules, 5)).toBe(true)
  })

  it('uses the displayed alternating sector for pointer validation', () => {
    const rules = [active('alternate-sector')]
    expect(requiredStartSector(8)).toBe('left')
    expect(requiredStartSector(9)).toBe('right')
    expect(validatePointerDownRules(rules, { x: 80, y: 50, width: 100, height: 100, pointerCount: 1, elapsedMs: 1000, round: 8, isPrimary: true }))
      .toMatchObject({ ruleId: 'alternate-sector', detail: 'LEFT sector required' })
    expect(validatePointerDownRules(rules, { x: 20, y: 50, width: 100, height: 100, pointerCount: 1, elapsedMs: 1000, round: 9, isPrimary: true }))
      .toMatchObject({ ruleId: 'alternate-sector', detail: 'RIGHT sector required' })
  })
})
