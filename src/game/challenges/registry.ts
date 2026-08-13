import { CHALLENGES } from './catalog'
import type { ChallengeDefinition, ChallengeKind, ChallengeRuntime } from '../types'

const registry = new Map<string, ChallengeDefinition>()
const runtimeByKind = new Map<ChallengeKind, ChallengeRuntime>()

for (const challenge of CHALLENGES) {
  if (registry.has(challenge.id)) throw new Error(`Duplicate challenge id: ${challenge.id}`)
  const existingRuntime = runtimeByKind.get(challenge.kind)
  if (existingRuntime && existingRuntime !== challenge.runtime) {
    throw new Error(`Challenge kind ${challenge.kind} is registered to multiple runtimes`)
  }
  registry.set(challenge.id, challenge)
  runtimeByKind.set(challenge.kind, challenge.runtime)
}

export function registeredChallenges(): readonly ChallengeDefinition[] {
  return [...registry.values()]
}

export function resolveChallengeRuntime(challenge: ChallengeDefinition): ChallengeRuntime {
  const registered = registry.get(challenge.id)
  if (!registered) throw new Error(`Unregistered challenge: ${challenge.id}`)
  return registered.runtime
}

export function validateChallengeRegistry(): string[] {
  const errors: string[] = []
  for (const challenge of registry.values()) {
    if (challenge.pointerRequirement.min < 0 || challenge.pointerRequirement.max < challenge.pointerRequirement.min) errors.push(`${challenge.id}: invalid pointer requirement`)
    if (challenge.expectedDuration > challenge.timeLimit) errors.push(`${challenge.id}: expected duration exceeds time limit`)
    if (challenge.instruction.trim().split(/\s+/).length > 8) errors.push(`${challenge.id}: instruction exceeds eight words`)
  }
  return errors
}
