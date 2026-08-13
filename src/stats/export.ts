import type { PersistedData } from '../game/types'

export function calculateStats(data: PersistedData) {
  const scores = data.leaderboard.map(entry => entry.score).sort((a, b) => a - b)
  const average = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0
  const middle = Math.floor(scores.length / 2)
  const median = scores.length ? (scores.length % 2 ? scores[middle]! : ((scores[middle - 1] ?? 0) + (scores[middle] ?? 0)) / 2) : 0
  const averageDuration = data.runDurations.length ? data.runDurations.reduce((sum, value) => sum + value, 0) / data.runDurations.length : 0
  const challengeRows = Object.entries(data.challengeStats).map(([id, stat]) => ({
    id,
    attempts: stat.attempts,
    completions: stat.completions,
    failures: stat.failures,
    completionRate: stat.attempts ? stat.completions / stat.attempts : 0,
    averageAccuracy: stat.attempts ? stat.scoreTotal / stat.attempts : 0,
    averageMeasurement: stat.measurementCount ? stat.measurementTotal / stat.measurementCount : undefined,
    averageMetrics: Object.fromEntries(Object.entries(stat.metricTotals ?? {}).map(([key, total]) => [key, total / (stat.metricCounts?.[key as keyof typeof stat.metricCounts] ?? 1)])),
  }))
  return { totalPlays: data.totalPlays, recordedScores: scores.length, averageScore: average, medianScore: median, highestScore: scores.at(-1) ?? 0, averageDurationMs: averageDuration, challenges: challengeRows }
}

export function downloadJson(data: PersistedData) {
  download(`human-verification-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), summary: calculateStats(data), data }, null, 2), 'application/json')
}

export function downloadCsv(data: PersistedData) {
  const header = 'name,score,date,challenges,best_combo,precision,duration_ms'
  const rows = data.leaderboard.map(entry => [entry.name, entry.score, entry.createdAt, entry.challenges, entry.bestCombo, entry.precision, entry.durationMs].map(csvCell).join(','))
  download(`human-verification-leaderboard-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows].join('\n'), 'text/csv')
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function download(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
