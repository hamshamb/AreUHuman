import type { ActiveRule } from '../../game/types'
import type { VerificationPhase } from '../../game/presentation'
import { requiredStartSector, RULES } from '../../game/rules/rules'

export type SystemTone = 'neutral' | 'verified' | 'warning' | 'failure' | 'information'

export function TerminalFrame({ state, phase = 'standard', children, className = '' }: { state: string; phase?: VerificationPhase; children: React.ReactNode; className?: string }) {
  return <main className={`terminal-frame ${className}`} data-state={state} data-phase={phase}>{children}</main>
}

export function TerminalHeader({ subjectId, status, humanity, testNumber, compact = false }: { subjectId?: string; status: string; humanity?: number; testNumber?: number; compact?: boolean }) {
  return (
    <header className={`terminal-header ${compact ? 'terminal-header--compact' : ''}`}>
      <div className="terminal-header__system"><span>AreUHuman SYSTEM</span><b>AUH-09</b></div>
      <div className="terminal-header__status"><span>STATUS</span><b>{status}</b></div>
      {subjectId && <SubjectIdentifier value={subjectId} />}
      {testNumber !== undefined && <div className="terminal-header__test"><span>TEST</span><b>{String(testNumber).padStart(2, '0')} / 32</b></div>}
      {humanity !== undefined && <HumanityDisplay value={humanity} />}
    </header>
  )
}

export function SubjectIdentifier({ value }: { value: string }) {
  return <div className="subject-identifier"><span>SUBJECT</span><b>{value.replace('SUBJECT_', '')}</b></div>
}

export function HumanityDisplay({ value, hero = false }: { value: number; hero?: boolean }) {
  return <div className={`humanity-display ${hero ? 'humanity-display--hero' : ''}`}><span>HUMANITY</span><b>{value.toFixed(2)}<i>%</i></b></div>
}

export function HumanityLine({ value = 0, tone = 'neutral', contacts = 0 }: { value?: number; tone?: SystemTone; contacts?: number }) {
  return <div className="humanity-line" data-tone={tone} style={{ '--humanity-value': `${Math.max(0.03, value / 100)}` } as React.CSSProperties} aria-hidden="true"><i />{Array.from({ length: contacts }, (_, index) => <b key={index} style={{ left: `${28 + index * 9}%` }} />)}</div>
}

export function TerminalDivider({ label }: { label?: string }) {
  return <div className="terminal-divider" aria-hidden="true">{label && <span>{label}</span>}</div>
}

export function CalibrationCross({ label, className = '' }: { label?: string; className?: string }) {
  return <span className={`calibration-cross ${className}`} aria-hidden="true"><i /><b>{label}</b></span>
}

export function MeasurementValue({ label, value, unit, delta, target, tone = 'neutral', hero = false }: { label: string; value: string | number; unit?: string; delta?: string; target?: string; tone?: SystemTone; hero?: boolean }) {
  return <div className={`measurement-value ${hero ? 'measurement-value--hero' : ''}`} data-tone={tone}><span>{label}</span><b>{value}<i>{unit}</i></b>{target && <small>TARGET {target}</small>}{delta && <em>{delta}</em>}</div>
}

export function VerificationStamp({ label, tone }: { label: string; tone: SystemTone }) {
  return <div className="verification-stamp" data-tone={tone} role="status">{label}</div>
}

export function ActiveConditions({ rules, round }: { rules: ActiveRule[]; round: number }) {
  if (!rules.length) return <div className="active-conditions active-conditions--empty"><span>ACTIVE CONDITIONS</span><b>NONE</b></div>
  return <aside className="active-conditions" aria-label="Active conditions"><span>ACTIVE CONDITIONS</span>{rules.map((rule, index) => <DiagnosticRule key={rule.id} index={index + 1} label={RULES[rule.id].name} detail={rule.memoryValue ? `RETAIN ${rule.memoryValue}` : rule.id === 'alternate-sector' ? `BEGIN ${requiredStartSector(round).toUpperCase()}` : undefined} />)}</aside>
}

export function DiagnosticRule({ index, label, detail }: { index: number; label: string; detail?: string }) {
  return <div className="diagnostic-rule"><i>{String(index).padStart(2, '0')}</i><b>{label}</b>{detail && <small>{detail}</small>}</div>
}

export function ContactMarker({ contact, x, y, pressure, detailed = false }: { contact: number; x: number; y: number; pressure?: number; detailed?: boolean }) {
  return <i className={`contact-marker ${detailed ? 'contact-marker--detailed' : ''}`} style={{ left: x, top: y }} aria-hidden="true"><b>+</b>{detailed && <span>CONTACT_{String(contact).padStart(2, '0')}<small>{pressure !== undefined ? `P ${pressure.toFixed(2)}` : ''}</small></span>}</i>
}

export function TestIdentifier({ category, number, variant }: { category: string; number: number; variant?: string }) {
  return <p className="test-identifier">{category} TEST // {String(number).padStart(2, '0')}{variant && variant !== 'STANDARD' ? ` // ${variant}` : ''}</p>
}

export function TerminalAction({ children, className = '', tone = 'neutral', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: SystemTone }) {
  return <button className={`terminal-action ${className}`} data-tone={tone} {...props}>{children}</button>
}
