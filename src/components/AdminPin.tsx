import { useEffect, useRef, useState } from 'react'

export function AdminPin({ expected, onSuccess, onCancel }: { expected: string; onSuccess: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    const dialog = panel.current
    if (!dialog) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const backdrop = dialog.parentElement
    const background: HTMLElement[] = backdrop?.parentElement
      ? [...backdrop.parentElement.children].filter((element): element is HTMLElement => element !== backdrop && element instanceof HTMLElement)
      : []
    const backgroundState = background.map(element => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }))

    for (const element of background) {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    }

    const focusable = () => [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    const focusFirst = () => (focusable()[0] ?? dialog).focus()

    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key !== 'Tab') return

      const controls = focusable()
      const first = controls[0]
      const last = controls.at(-1)
      if (!first || !last) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    const focusin = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) focusFirst()
    }

    document.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', focusin, true)
    focusFirst()

    return () => {
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('focusin', focusin, true)
      for (const state of backgroundState) {
        state.element.inert = state.inert
        if (state.ariaHidden === null) state.element.removeAttribute('aria-hidden')
        else state.element.setAttribute('aria-hidden', state.ariaHidden)
      }
      const restoreTarget = previouslyFocused?.isConnected
        ? previouslyFocused
        : document.querySelector<HTMLElement>('.brand-lockup')
      restoreTarget?.focus()
    }
  }, [onCancel])

  const press = (value: string) => {
    const next = `${pin}${value}`.slice(0, Math.max(4, expected.length))
    setPin(next)
    setError(false)
    if (next.length === expected.length) {
      if (next === expected) onSuccess()
      else { setPin(''); setError(true) }
    }
  }

  const clear = () => {
    setPin('')
    setError(false)
  }

  return (
    <div className="modal-backdrop">
      <section ref={panel} className="pin-panel" role="dialog" aria-modal="true" aria-labelledby="pin-title" aria-describedby="pin-description" tabIndex={-1}>
        <span>HV-09 // AUTHORIZED OPERATOR</span>
        <h2 id="pin-title">OPERATOR ACCESS</h2>
        <p id="pin-description">ENTER LOCAL CONTROL PIN</p>
        <div className={error ? 'pin-dots error' : 'pin-dots'} aria-label={`${pin.length} of ${expected.length} digits entered`}>
          {Array.from({ length: expected.length }, (_, index) => <i key={index} className={index < pin.length ? 'filled' : ''} />)}
        </div>
        {error && <p className="pin-error" role="alert">ACCESS CODE REJECTED</p>}
        <div className="pin-keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(number => <button type="button" key={number} onClick={() => press(number)}>{number}</button>)}
          <button type="button" onClick={onCancel}>CANCEL</button>
          <button type="button" onClick={() => press('0')}>0</button>
          <button type="button" onClick={clear}>CLEAR</button>
        </div>
      </section>
    </div>
  )
}
