import type { Difficulty, GameSettings } from './types'

export const DEFAULT_SETTINGS: GameSettings = {
  title: 'AreUHuman',
  tagline: 'How well can you actually use a touchscreen?',
  smallCopy: "Most people think they're good at this.",
  gameEnabled: true,
  freePlay: true,
  credits: 0,
  tokenLabel: 'TOKEN',
  tokenPriceText: '1 TOKEN • 1 ATTEMPT',
  attemptsPerCredit: 1,
  defaultLives: 3,
  difficulty: 'medium',
  persistentRules: true,
  leaderboardEnabled: true,
  leaderboardLength: 10,
  prizeTiers: [
    { id: 'bronze', name: 'BRONZE', threshold: 80, enabled: true },
    { id: 'silver', name: 'SILVER', threshold: 90, enabled: true },
    { id: 'gold', name: 'GOLD', threshold: 95, enabled: true },
    { id: 'club99', name: '99 CLUB', threshold: 99, enabled: true },
  ],
  scoreBands: [
    { threshold: 0, label: 'NEEDS PRACTICE' },
    { threshold: 50, label: 'CASUAL TAPPER' },
    { threshold: 70, label: 'TOUCH TRAINED' },
    { threshold: 85, label: 'ELITE' },
    { threshold: 95, label: 'TOUCH MASTER' },
    { threshold: 99, label: '99 CLUB' },
  ],
  adminPin: '9900',
  blockedWords: ['BADWORD'],
  nameMaxLength: 12,
  attractTimeoutSeconds: 18,
  resultTimeoutSeconds: 20,
  masterVolume: 0.7,
  musicVolume: 0.22,
  sfxVolume: 0.7,
  muted: false,
  reducedMotion: false,
  highContrast: false,
  showFps: false,
  touchVisualizer: false,
  screenScale: 1,
}

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 0.84,
  medium: 1,
  hard: 1.18,
}

export const MAX_ROUNDS = 32
export const INPUT_LOCK_MS = 280

export const CHEEKY_LINES = [
  'That was easy.',
  "Surely you can't miss this.",
  'Interesting.',
  'Still confident?',
  'Your fingers are getting nervous.',
  'Do not overthink this.',
  'Actually, maybe overthink it.',
  'One instruction. That is all.',
  'Focus.',
  'Remember the rule?',
]
