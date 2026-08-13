import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminPin } from '../components/AdminPin'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | undefined

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = undefined
  document.body.replaceChildren()
})

describe('operator PIN modal', () => {
  it('traps focus, makes its sibling background inert, and restores focus on close', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'OPEN OPERATOR ACCESS'
    document.body.append(trigger)
    trigger.focus()

    const host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    const cancel = vi.fn()

    act(() => root?.render(<><div id="background"><button>BACKGROUND ACTION</button></div><AdminPin expected="9900" onSuccess={vi.fn()} onCancel={cancel} /></>))

    const background = host.querySelector<HTMLElement>('#background')!
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!
    const controls = [...dialog.querySelectorAll<HTMLButtonElement>('button')]
    const first = controls[0]!
    const last = controls.at(-1)!

    expect(background.inert).toBe(true)
    expect(background.getAttribute('aria-hidden')).toBe('true')
    expect(document.activeElement).toBe(first)

    last.focus()
    act(() => last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })))
    expect(document.activeElement).toBe(first)

    first.focus()
    act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })))
    expect(document.activeElement).toBe(last)

    act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    expect(cancel).toHaveBeenCalledOnce()

    act(() => root?.unmount())
    root = undefined
    expect(background.inert).not.toBe(true)
    expect(background.hasAttribute('aria-hidden')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })
})
