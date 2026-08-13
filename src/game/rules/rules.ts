import type { ActiveRule, ChallengeDefinition, RuleDefinition, RuleId } from '../types'
import { mulberry32, pick } from '../rng'

export const RULES: Record<RuleId, RuleDefinition> = {
  'avoid-red': { id: 'avoid-red', name: 'AVOID SIGNAL RED', short: 'Red contact is invalid', difficulty: 2, duration: 5, incompatible: ['ignore-upside-down'], validator: 'danger-color' },
  'two-finger-third': { id: 'two-finger-third', name: 'DUAL CONTACT ON THIRD', short: 'Every third response uses two contacts', difficulty: 3, duration: 6, incompatible: ['no-repeat', 'single-contact'], validator: 'pointer-count' },
  'no-repeat': { id: 'no-repeat', name: 'VARY MOTOR RESPONSE', short: 'Do not repeat a gesture family', difficulty: 2, duration: 5, incompatible: ['two-finger-third'], validator: 'gesture-repeat' },
  'opposite-day': { id: 'opposite-day', name: 'INVERT DIRECTION', short: 'Directional instructions are reversed', difficulty: 3, duration: 4, incompatible: ['ignore-upside-down'], incompatibleGestures: ['memory', 'logic', 'timing', 'hold', 'drag', 'multi-touch', 'inhibition'], validator: 'opposite-direction' },
  'remember-star': { id: 'remember-star', name: 'RETAIN CONTROL NUMBER', short: 'Keep the displayed number in memory', difficulty: 2, duration: 7, incompatible: [], validator: 'memory' },
  'freeze-means-freeze': { id: 'freeze-means-freeze', name: 'FREEZE MEANS FREEZE', short: 'No contact during the freeze interval', difficulty: 2, duration: 5, incompatible: ['two-finger-third'], validator: 'freeze' },
  'protect-pix': { id: 'protect-pix', name: 'MAINTAIN PIX SHIELD', short: 'Recharge PIX before shielding reaches zero', difficulty: 3, duration: 5, incompatible: [], validator: 'mascot' },
  'ignore-upside-down': { id: 'ignore-upside-down', name: 'IGNORE INVERTED COPY', short: 'Rotated instructions are decoys', difficulty: 2, duration: 5, incompatible: ['opposite-day', 'avoid-red'], validator: 'decoy' },
  'wait-for-clearance': { id: 'wait-for-clearance', name: 'WAIT FOR CLEARANCE', short: 'Do not respond before CLEAR', difficulty: 2, duration: 5, incompatible: [], incompatibleGestures: ['inhibition'], validator: 'wait' },
  'alternate-sector': { id: 'alternate-sector', name: 'ALTERNATE START SECTOR', short: 'Begin on the shown LEFT/RIGHT side', difficulty: 3, duration: 6, incompatible: [], incompatibleGestures: ['inhibition', 'multi-touch'], validator: 'screen-sector' },
  'central-contact': { id: 'central-contact', name: 'EDGE CONTACT PROHIBITED', short: 'Begin inside the central calibration field', difficulty: 2, duration: 5, incompatible: [], incompatibleGestures: ['inhibition'], validator: 'center-start' },
  'single-contact': { id: 'single-contact', name: 'ONE CONTACT MAXIMUM', short: 'Only one active pointer is permitted', difficulty: 3, duration: 5, incompatible: ['two-finger-third'], incompatibleGestures: ['multi-touch'], validator: 'single-pointer' },
}

export interface RulePointerContext {
  x: number
  y: number
  width: number
  height: number
  pointerCount: number
  elapsedMs: number
  round: number
  isPrimary: boolean
}

export interface RuleViolation {
  ruleId: RuleId
  message: string
  detail: string
}

export function isRuleCompatible(id: RuleId, active: ActiveRule[], challenge?: ChallengeDefinition): boolean {
  const definition = RULES[id]
  if (active.some(rule => rule.id === id || definition.incompatible.includes(rule.id) || RULES[rule.id].incompatible.includes(id))) return false
  if (!challenge) return true
  if (challenge.incompatibleRules?.includes(id)) return false
  if (definition.incompatibleGestures?.includes(challenge.gesture)) return false
  if (id === 'single-contact' && challenge.pointerRequirement.max > 1) return false
  if (id === 'two-finger-third' && challenge.pointerRequirement.max === 0) return false
  return true
}

export function expireRules(active: ActiveRule[], round: number): ActiveRule[] {
  return active.filter(rule => rule.expiresAt > round)
}

export function maybeAddRule(active: ActiveRule[], round: number, seed: number, challenge?: ChallengeDefinition): ActiveRule[] {
  if (round < 7 || round % 3 !== 1 || active.length >= (round > 22 ? 4 : 3)) return active
  const random = mulberry32(seed ^ round)
  const candidates = (Object.keys(RULES) as RuleId[]).filter(id => RULES[id].difficulty <= (round > 18 ? 3 : 2) && isRuleCompatible(id, active, challenge))
  if (!candidates.length) return active
  const id = pick(candidates, random)
  return [...active, {
    id,
    activatedAt: round,
    expiresAt: round + RULES[id].duration,
    memoryValue: id === 'remember-star' ? 2 + Math.floor(random() * 8) : undefined,
  }]
}

export function requiresTwoFingers(active: ActiveRule[], validatedActions: number): boolean {
  return active.some(rule => rule.id === 'two-finger-third') && (validatedActions + 1) % 3 === 0
}

export function hasRule(active: ActiveRule[], id: RuleId): boolean {
  return active.some(rule => rule.id === id)
}

export function requiredStartSector(round: number): 'left' | 'right' {
  return round % 2 === 0 ? 'left' : 'right'
}

export function validatePointerDownRules(active: ActiveRule[], context: RulePointerContext): RuleViolation | undefined {
  if (hasRule(active, 'wait-for-clearance') && context.elapsedMs < 700) {
    return { ruleId: 'wait-for-clearance', message: 'PREMATURE CONTACT', detail: `${Math.round(700 - context.elapsedMs)}ms before clearance` }
  }
  if (hasRule(active, 'single-contact') && context.pointerCount > 1) {
    return { ruleId: 'single-contact', message: 'EXCESS CONTACT', detail: `${context.pointerCount} contacts detected; one permitted` }
  }
  if (context.isPrimary && hasRule(active, 'central-contact')) {
    const nx = context.x / context.width
    const ny = context.y / context.height
    if (nx < 0.12 || nx > 0.88 || ny < 0.1 || ny > 0.9) {
      return { ruleId: 'central-contact', message: 'EDGE CONTACT', detail: 'Initial contact must be inside the central field' }
    }
  }
  if (context.isPrimary && hasRule(active, 'alternate-sector')) {
    const expected = requiredStartSector(context.round)
    const actual = context.x < context.width / 2 ? 'left' : 'right'
    if (actual !== expected) return { ruleId: 'alternate-sector', message: 'WRONG START SECTOR', detail: `${expected.toUpperCase()} sector required` }
  }
  return undefined
}

export function oppositeDirection(direction: 'left' | 'right' | 'up' | 'down'): 'left' | 'right' | 'up' | 'down' {
  if (direction === 'left') return 'right'
  if (direction === 'right') return 'left'
  if (direction === 'up') return 'down'
  return 'up'
}
