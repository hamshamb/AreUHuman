export type VerificationPhase = 'standard' | 'observing' | 'suspicious' | 'pressure' | 'unstable' | 'hostile'

export function verificationPhase(round: number): VerificationPhase {
  if (round < 4) return 'standard'
  if (round < 8) return 'observing'
  if (round < 13) return 'suspicious'
  if (round < 19) return 'pressure'
  if (round < 26) return 'unstable'
  return 'hostile'
}

export function phaseMessage(phase: VerificationPhase): string {
  if (phase === 'observing') return 'SUBJECT RESPONSE ABOVE BASELINE'
  if (phase === 'suspicious') return 'ADDITIONAL CONDITIONS AUTHORIZED'
  if (phase === 'pressure') return 'SUBJECT REQUIRES FURTHER TESTING'
  if (phase === 'unstable') return 'BEHAVIORAL MODEL INCONCLUSIVE'
  if (phase === 'hostile') return 'PERFORMANCE EXCEEDS EXPECTED HUMAN RANGE'
  return 'STANDARD HUMAN MOTOR ASSESSMENT'
}

export function subjectIdFromSeed(seed: number): string {
  return `SUBJECT_${String(Math.abs(Math.trunc(seed)) % 10000).padStart(4, '0')}`
}
