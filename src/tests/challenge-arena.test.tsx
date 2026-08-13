import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChallengeArena } from '../components/challenges/ChallengeArena'
import { getChallenge } from '../game/challenges/catalog'
import type { ActiveRule, ChallengeDefinition, ChallengeResult } from '../game/types'
import { resetSession } from '../storage/store'

interface PointerInit {
  pointerId: number
  clientX: number
  clientY: number
  buttons?: number
}

function dispatchPointer(target: Element, type: string, init: PointerInit) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  const properties = {
    pointerId: init.pointerId,
    pointerType: 'touch',
    isPrimary: init.pointerId === 1,
    clientX: init.clientX,
    clientY: init.clientY,
    pressure: type === 'pointerup' || type === 'pointercancel' ? 0 : 0.5,
    buttons: init.buttons ?? (type === 'pointerup' || type === 'pointercancel' ? 0 : 1),
  }
  for (const [key, value] of Object.entries(properties)) Object.defineProperty(event, key, { value })
  target.dispatchEvent(event)
}

function challenge(id: string): ChallengeDefinition {
  const found = getChallenge(id)
  if (!found) throw new Error(`Missing challenge ${id}`)
  return found
}

const roots: Root[] = []

async function renderArena(definition: ChallengeDefinition, activeRules: ActiveRule[] = [], round = 0) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  const onResult = vi.fn<(result: ChallengeResult) => void>()
  const onPointerCountChange = vi.fn<(count: number) => void>()
  const session = { ...resetSession(3, 1234), activeRules }
  await act(async () => {
    root.render(<ChallengeArena challenge={definition} tier={2} seed={1234} round={round} session={session} subjectId="SUBJECT_TEST" activeRules={activeRules} touchVisualizer={false} onPointerCountChange={onPointerCountChange} onResult={onResult} />)
  })
  return { container, onResult, onPointerCountChange }
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0))
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => window.clearTimeout(handle))
  if (!HTMLElement.prototype.setPointerCapture) Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: () => undefined })
})

afterEach(async () => {
  await act(async () => {
    while (roots.length) roots.pop()?.unmount()
  })
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('ChallengeArena pointer enforcement', () => {
  it('accepts a two-contact swipe using the peak count before pointer-up capture removes the action pointer', async () => {
    const rule: ActiveRule = { id: 'two-finger-third', activatedAt: 0, expiresAt: 9 }
    const { container, onResult } = await renderArena(challenge('swipe-direction'), [rule], 2)
    const arena = container.querySelector('.challenge-screen')!
    const swipe = container.querySelector('.swipe-pad')!

    await act(async () => {
      dispatchPointer(arena, 'pointerdown', { pointerId: 1, clientX: 40, clientY: 80 })
      dispatchPointer(swipe, 'pointerdown', { pointerId: 2, clientX: 100, clientY: 120 })
      dispatchPointer(swipe, 'pointerup', { pointerId: 2, clientX: 240, clientY: 120 })
    })

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0]?.[0]).toMatchObject({ success: true, message: 'VECTOR VERIFIED' })
  })

  it('rejects contacts above the base maximum and removes cancelled pointers from the active count', async () => {
    const { container, onResult, onPointerCountChange } = await renderArena(challenge('swipe-direction'))
    const swipe = container.querySelector('.swipe-pad')!

    await act(async () => {
      dispatchPointer(swipe, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 120 })
      dispatchPointer(swipe, 'pointerdown', { pointerId: 2, clientX: 120, clientY: 120 })
      dispatchPointer(swipe, 'pointercancel', { pointerId: 2, clientX: 120, clientY: 120 })
      dispatchPointer(swipe, 'pointercancel', { pointerId: 1, clientX: 100, clientY: 120 })
    })

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0]?.[0]).toMatchObject({ success: false, message: 'EXCESS CONTACT', metrics: { pointerCount: 2 } })
    expect(onPointerCountChange).toHaveBeenLastCalledWith(0)
  })

  it('preserves declared multi-touch mechanics', async () => {
    const { container, onResult } = await renderArena(challenge('tap-both'))
    const targets = container.querySelectorAll('.multi-target')

    await act(async () => {
      dispatchPointer(targets[0]!, 'pointerdown', { pointerId: 1, clientX: 80, clientY: 120 })
      dispatchPointer(targets[1]!, 'pointerdown', { pointerId: 2, clientX: 280, clientY: 120 })
    })

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0]?.[0]).toMatchObject({ success: true })
  })
})
