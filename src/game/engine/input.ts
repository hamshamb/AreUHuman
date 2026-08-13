export interface Point {
  x: number
  y: number
}

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function swipeDirection(start: Point, end: Point): 'left' | 'right' | 'up' | 'down' {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'down' : 'up'
}

export function simultaneousDifference(timestamps: number[]): number {
  if (timestamps.length < 2) return Number.POSITIVE_INFINITY
  return Math.max(...timestamps) - Math.min(...timestamps)
}

export function pointInRect(point: Point, rect: Rect, padding = 0): boolean {
  return point.x >= rect.left - padding && point.x <= rect.right + padding && point.y >= rect.top - padding && point.y <= rect.bottom + padding
}

export function segmentIntersectsRect(start: Point, end: Point, rect: Rect, padding = 0): boolean {
  const left = rect.left - padding
  const right = rect.right + padding
  const top = rect.top - padding
  const bottom = rect.bottom + padding
  const dx = end.x - start.x
  const dy = end.y - start.y
  let entry = 0
  let exit = 1

  const clips: Array<[number, number]> = [
    [-dx, start.x - left],
    [dx, right - start.x],
    [-dy, start.y - top],
    [dy, bottom - start.y],
  ]

  for (const [direction, offset] of clips) {
    if (direction === 0) {
      if (offset < 0) return false
      continue
    }
    const ratio = offset / direction
    if (direction < 0) entry = Math.max(entry, ratio)
    else exit = Math.min(exit, ratio)
    if (entry > exit) return false
  }

  return true
}

export function traceCoverage(points: Point[], width: number, height: number): { coverage: number; maxError: number } {
  if (
    points.length === 0
    || !Number.isFinite(width)
    || !Number.isFinite(height)
    || width <= 0
    || height <= 0
    || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))
  ) return { coverage: 0, maxError: Number.POSITIVE_INFINITY }

  const endpointTolerance = width * 0.08
  const backtrackTolerance = width * 0.015
  const maxNormalizedSegment = 0.22
  const sampleSpacing = 0.01
  const first = points[0]!
  const last = points.at(-1)!
  let maxError = 0
  let furthestX = first.x
  let validTraversal = Math.abs(first.x) <= endpointTolerance

  const measureError = (point: Point) => {
    const normalizedX = Math.max(0, Math.min(1, point.x / width))
    const expectedY = height * (0.5 + Math.sin(normalizedX * Math.PI * 2) * 0.18)
    maxError = Math.max(maxError, Math.abs(point.y - expectedY))
  }

  measureError(first)
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!
    const point = points[index]!
    const normalizedLength = Math.hypot((point.x - previous.x) / width, (point.y - previous.y) / height)

    if (point.x < furthestX - backtrackTolerance || normalizedLength > maxNormalizedSegment) validTraversal = false
    if (point.x < -endpointTolerance || point.x > width + endpointTolerance) validTraversal = false

    const samples = Math.max(1, Math.ceil(normalizedLength / sampleSpacing))
    for (let sample = 1; sample <= samples; sample += 1) {
      const progress = sample / samples
      measureError({
        x: previous.x + (point.x - previous.x) * progress,
        y: previous.y + (point.y - previous.y) * progress,
      })
    }
    furthestX = Math.max(furthestX, point.x)
  }

  if (Math.abs(width - last.x) > endpointTolerance) validTraversal = false

  return {
    coverage: validTraversal ? Math.max(0, Math.min(1, furthestX / width)) : 0,
    maxError,
  }
}
