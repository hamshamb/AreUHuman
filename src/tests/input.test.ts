import { describe, expect, it } from 'vitest'
import { distance, pointInRect, segmentIntersectsRect, simultaneousDifference, swipeDirection, traceCoverage } from '../game/engine/input'

describe('central pointer math', () => {
  it('measures drag and swipe vectors', () => {
    expect(distance({ x: 0, y: 0 }, { x: 300, y: 0 })).toBe(300)
    expect(swipeDirection({ x: 40, y: 20 }, { x: 250, y: 45 })).toBe('right')
    expect(swipeDirection({ x: 20, y: 90 }, { x: 10, y: 0 })).toBe('up')
  })

  it('measures simultaneous touch timestamps', () => {
    expect(simultaneousDifference([1000, 1038])).toBe(38)
    expect(simultaneousDifference([1000])).toBe(Infinity)
  })

  it('handles hit testing and trace drift', () => {
    expect(pointInRect({ x: 9, y: 12 }, { left: 10, top: 10, right: 20, bottom: 20 }, 2)).toBe(true)
    const points = Array.from({ length: 101 }, (_, index) => ({ x: index * 10, y: 150 + Math.sin(index / 100 * Math.PI * 2) * 54 }))
    const trace = traceCoverage(points, 1000, 300)
    expect(trace.coverage).toBe(1)
    expect(trace.maxError).toBeLessThan(1)
  })

  it('detects a swept pointer crossing a thin rectangle', () => {
    const hazard = { left: 49, top: 40, right: 51, bottom: 60 }
    expect(segmentIntersectsRect({ x: 0, y: 50 }, { x: 100, y: 50 }, hazard)).toBe(true)
    expect(segmentIntersectsRect({ x: 0, y: 30 }, { x: 100, y: 30 }, hazard)).toBe(false)
    expect(segmentIntersectsRect({ x: 0, y: 35 }, { x: 100, y: 35 }, hazard, 5)).toBe(true)
  })

  it('rejects traces that skip the start or finish', () => {
    const pathPoint = (x: number) => ({ x, y: 150 + Math.sin(x / 1000 * Math.PI * 2) * 54 })
    expect(traceCoverage(Array.from({ length: 9 }, (_, index) => pathPoint(200 + index * 100)), 1000, 300).coverage).toBe(0)
    expect(traceCoverage(Array.from({ length: 9 }, (_, index) => pathPoint(index * 100)), 1000, 300).coverage).toBe(0)
  })

  it('rejects teleporting and backtracking even when every recorded point is on the path', () => {
    const pathPoint = (x: number) => ({ x, y: 150 + Math.sin(x / 1000 * Math.PI * 2) * 54 })
    const teleported = traceCoverage([pathPoint(0), pathPoint(500), pathPoint(1000)], 1000, 300)
    const backtracked = traceCoverage([
      ...Array.from({ length: 6 }, (_, index) => pathPoint(index * 100)),
      pathPoint(400),
      ...Array.from({ length: 6 }, (_, index) => pathPoint(500 + index * 100)),
    ], 1000, 300)

    expect(teleported.coverage).toBe(0)
    expect(teleported.maxError).toBeGreaterThan(40)
    expect(backtracked.coverage).toBe(0)
  })
})
