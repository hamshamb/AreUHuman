export function mulberry32(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)]
  if (item === undefined) throw new Error('Cannot pick from an empty list')
  return item
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    const current = copy[index]
    const other = copy[target]
    if (current !== undefined && other !== undefined) {
      copy[index] = other
      copy[target] = current
    }
  }
  return copy
}

export function hashSeed(...parts: number[]): number {
  return parts.reduce((hash, part) => Math.imul(hash ^ part, 16777619) >>> 0, 2166136261)
}
