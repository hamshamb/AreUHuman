import { useState } from 'react'
import type { GameSettings } from '../game/types'
import { Pix } from './Pix'
import { TerminalAction, TerminalFrame, TerminalHeader } from './terminal/TerminalPrimitives'

interface Props { settings: GameSettings; onComplete: (settings: GameSettings) => void }

export function SetupScreen({ settings, onComplete }: Props) {
  const [draft, setDraft] = useState(settings)
  return (
    <TerminalFrame state="operator" className="setup-screen">
      <TerminalHeader status="COMMISSIONING REQUIRED" />
      <section className="setup-intro"><Pix label /><span>FIRST RUN // AUTHORIZED OPERATOR</span><h1>HV-09 TERMINAL COMMISSIONING</h1><p>Confirm four local defaults. All values remain on this display and can be changed later through operator access.</p></section>
      <section className="setup-form">
        <label><span>DISPLAY TITLE</span><input value={draft.title} maxLength={32} onChange={event => setDraft({ ...draft, title: event.target.value || settings.title })} /></label>
        <label className="switch-row"><span>INTAKE MODE<small>{draft.freePlay ? 'Verification available without operator credit' : 'An available attempt is required'}</small></span><button type="button" aria-pressed={draft.freePlay} className={draft.freePlay ? 'active' : ''} onClick={() => setDraft({ ...draft, freePlay: !draft.freePlay })}>{draft.freePlay ? 'FREE PLAY' : 'TOKEN CONTROL'}</button></label>
        <label><span>AUDIO OUTPUT</span><input type="range" min="0" max="1" step="0.05" value={draft.masterVolume} onChange={event => setDraft({ ...draft, masterVolume: Number(event.target.value) })} /><output>{Math.round(draft.masterVolume * 100)}%</output></label>
        <label><span>99 CLUB THRESHOLD</span><input type="number" min="90" max="99.9" step="0.1" value={draft.prizeTiers.find(tier => tier.id === 'club99')?.threshold ?? 99} onChange={event => setDraft({ ...draft, prizeTiers: draft.prizeTiers.map(tier => tier.id === 'club99' ? { ...tier, threshold: Number(event.target.value) } : tier) })} /><output>%</output></label>
      </section>
      <div className="setup-actions"><TerminalAction onClick={() => onComplete(settings)}>USE CALIBRATED DEFAULTS</TerminalAction><TerminalAction tone="verified" onClick={() => onComplete(draft)}>COMMISSION TERMINAL</TerminalAction></div>
    </TerminalFrame>
  )
}
