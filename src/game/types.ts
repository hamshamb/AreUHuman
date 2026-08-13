export type Difficulty = 'easy' | 'medium' | 'hard'

export type Gesture =
  | 'tap'
  | 'hold'
  | 'swipe'
  | 'drag'
  | 'multi-touch'
  | 'memory'
  | 'timing'
  | 'logic'
  | 'inhibition'

export type ChallengeCategory =
  | 'REACTION'
  | 'TIMING'
  | 'PRECISION'
  | 'MEMORY'
  | 'MULTITOUCH'
  | 'DRAG'
  | 'SWIPE'
  | 'RHYTHM'
  | 'LOGIC'
  | 'INHIBITION'
  | 'TRACKING'
  | 'COORDINATION'
  | 'RULE_BASED'
  | 'MASCOT'
  | 'SPECIAL'

export type ChallengeRuntime = 'interaction' | 'memory' | 'logic'

export interface TierValues {
  easy: number
  medium: number
  hard: number
}

export type ChallengeKind =
  | 'basic-tap'
  | 'exact-hold'
  | 'stop-needle'
  | 'shrinking-target'
  | 'simultaneous-tap'
  | 'swipe-direction'
  | 'distance-swipe'
  | 'trace-path'
  | 'do-nothing'
  | 'hold-and-tap'
  | 'finger-twister'
  | 'finger-replacement'
  | 'moving-target'
  | 'runaway-target'
  | 'memory-sequence'
  | 'reverse-memory'
  | 'delayed-memory'
  | 'odd-one-out'
  | 'track-target'
  | 'rhythm-copy'
  | 'tap-on-beat'
  | 'red-green'
  | 'count-flashes'
  | 'stroop'
  | 'tap-order'
  | 'safe-path'
  | 'moving-safe-path'
  | 'multi-object-hold'
  | 'precision-drop'
  | 'pressure-bar'
  | 'prime-tap'
  | 'previous-shape'
  | 'disappearing-position'
  | 'screen-quadrant'
  | 'gesture-sequence'
  | 'alternating-taps'
  | 'dual-meters'
  | 'size-order'
  | 'after-flashes'
  | 'system-check'
  | 'angle-swipe'
  | 'speed-swipe'
  | 'scratch-scan'
  | 'draw-shape'

export type RuleId =
  | 'avoid-red'
  | 'two-finger-third'
  | 'no-repeat'
  | 'opposite-day'
  | 'remember-star'
  | 'freeze-means-freeze'
  | 'protect-pix'
  | 'ignore-upside-down'
  | 'wait-for-clearance'
  | 'alternate-sector'
  | 'central-contact'
  | 'single-contact'

export type RuleValidator =
  | 'danger-color'
  | 'pointer-count'
  | 'gesture-repeat'
  | 'opposite-direction'
  | 'memory'
  | 'freeze'
  | 'mascot'
  | 'decoy'
  | 'wait'
  | 'screen-sector'
  | 'center-start'
  | 'single-pointer'

export interface RuleDefinition {
  id: RuleId
  name: string
  short: string
  difficulty: number
  duration: number
  incompatible: RuleId[]
  incompatibleGestures?: Gesture[]
  validator: RuleValidator
}

export interface ChallengeTuning {
  targetMs?: number
  toleranceMs?: TierValues
  targetDistancePx?: number
  targetAngleDeg?: number
  targetVelocityPxPerSecond?: number
  targetValue?: number
  tolerance?: TierValues
  requiredPointers?: number
  sequenceLength?: TierValues
  revealThreshold?: TierValues
}

export interface ChallengeDefinition {
  id: string
  name: string
  kind: ChallengeKind
  variant: string
  category: ChallengeCategory
  runtime: ChallengeRuntime
  gesture: Gesture
  instruction: string
  minRound: number
  timeLimit: number
  expectedDuration: number
  pointerRequirement: { min: number; max: number }
  tuning?: ChallengeTuning
  incompatibleRules?: RuleId[]
  accessibility: string
}

export interface ActiveRule {
  id: RuleId
  activatedAt: number
  expiresAt: number
  memoryValue?: number
}

export interface ChallengeResult {
  success: boolean
  accuracy: number
  message: string
  detail?: string
  measurement?: number
  normalizedMiss?: number
  durationMs?: number
  metrics?: ChallengeMetrics
}

export interface ChallengeMetrics {
  reactionMs?: number
  timingErrorMs?: number
  precisionErrorPx?: number
  simultaneousDeltaMs?: number
  pathCoverage?: number
  maxPathErrorPx?: number
  swipeDistancePx?: number
  swipeAngleErrorDeg?: number
  swipeVelocityPxPerSecond?: number
  revealedPercent?: number
  sequenceLength?: number
  pointerCount?: number
  completionTimeMs?: number
}

export interface SessionPerformance {
  seed: number
  startedAt: number
  completed: number
  failures: number
  lives: number
  maxLives: number
  combo: number
  bestCombo: number
  accuracyTotal: number
  lastGesture?: Gesture
  recentChallengeIds: string[]
  recentCategories: ChallengeCategory[]
  results: ChallengeResult[]
  activeRules: ActiveRule[]
  nearestMiss?: string
  nearestMissValue?: number
}

export interface LeaderboardEntry {
  id: string
  name: string
  score: number
  createdAt: string
  challenges: number
  bestCombo: number
  precision: number
  durationMs: number
}

export interface ChallengeStats {
  attempts: number
  completions: number
  failures: number
  scoreTotal: number
  measurementTotal: number
  measurementCount: number
  metricTotals: Partial<Record<keyof ChallengeMetrics, number>>
  metricCounts: Partial<Record<keyof ChallengeMetrics, number>>
}

export interface PrizeTier {
  id: string
  name: string
  threshold: number
  enabled: boolean
}

export interface ScoreBand {
  threshold: number
  label: string
}

export interface GameSettings {
  title: string
  tagline: string
  smallCopy: string
  gameEnabled: boolean
  freePlay: boolean
  credits: number
  tokenLabel: string
  tokenPriceText: string
  attemptsPerCredit: number
  defaultLives: number
  difficulty: Difficulty
  persistentRules: boolean
  leaderboardEnabled: boolean
  leaderboardLength: number
  prizeTiers: PrizeTier[]
  scoreBands: ScoreBand[]
  adminPin: string
  blockedWords: string[]
  nameMaxLength: number
  attractTimeoutSeconds: number
  resultTimeoutSeconds: number
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  muted: boolean
  reducedMotion: boolean
  highContrast: boolean
  showFps: boolean
  touchVisualizer: boolean
  screenScale: number
}

export interface SessionSummary {
  subjectId: string
  score: number
  category: string
  prize?: PrizeTier
  completed: number
  bestCombo: number
  precision: number
  durationMs: number
  nearestMiss?: string
  rankToday?: number
  isPersonalBest: boolean
  isNewStandard: boolean
  failures: number
  endReason: 'tolerance-exhausted' | 'completed'
  bestTimingErrorMs?: number
}

export interface PersistedData {
  version: 1
  setupComplete: boolean
  settings: GameSettings
  leaderboard: LeaderboardEntry[]
  challengeStats: Record<string, ChallengeStats>
  totalPlays: number
  personalBest: number
  runDurations: number[]
  diagnostics: string[]
}

export interface ChallengeTestSpec {
  id: string
  difficulty: Difficulty
  rules: RuleId[]
  seed: number
}
