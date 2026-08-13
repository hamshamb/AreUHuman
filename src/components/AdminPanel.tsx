import { useState } from 'react'
import { CHALLENGES } from '../game/challenges/catalog'
import { isRuleCompatible, RULES } from '../game/rules/rules'
import type { ChallengeResult, ChallengeTestSpec, Difficulty, GameSettings, PersistedData, RuleId } from '../game/types'
import { calculateStats, downloadCsv, downloadJson } from '../stats/export'
import { normalizeSettings, sortLeaderboard, todayEntries } from '../storage/store'
import { TouchDiagnostics } from './TouchDiagnostics'

type Tab = 'system' | 'carnival' | 'records' | 'audio' | 'display' | 'playtest' | 'hardware' | 'stats'

interface Props {
  data: PersistedData
  activeRules: RuleId[]
  lastTestSpec?: ChallengeTestSpec
  lastTestResult?: ChallengeResult
  onSettings: (settings: GameSettings) => void
  onData: (data: PersistedData) => void
  onTestChallenge: (id: string, difficulty: Difficulty, rules?: RuleId[], seed?: number) => void
  onFullscreen: () => void
  onClose: () => void
}

export function AdminPanel({ data, activeRules, lastTestSpec, lastTestResult, onSettings, onData, onTestChallenge, onFullscreen, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('system')
  const [challengeFilter, setChallengeFilter] = useState('')
  const [selectedRules, setSelectedRules] = useState<RuleId[]>([])
  const [testSeed, setTestSeed] = useState(() => Date.now())
  const settings = data.settings
  const patch = (changes: Partial<GameSettings>) => onSettings(normalizeSettings({ ...settings, ...changes }))
  const stats = calculateStats(data)
  const filteredChallenges = CHALLENGES.filter(item => `${item.name} ${item.id} ${item.category} ${item.variant}`.toLowerCase().includes(challengeFilter.toLowerCase()))

  const clearToday = () => {
    if (!window.confirm('Clear all records created today on this terminal?')) return
    const today = new Set(todayEntries(data.leaderboard).map(entry => entry.id))
    onData({ ...data, leaderboard: data.leaderboard.filter(entry => !today.has(entry.id)) })
  }
  const clearAll = () => {
    if (window.confirm('Clear the complete local leaderboard? This cannot be undone.')) onData({ ...data, leaderboard: [] })
  }
  const toggleRule = (id: RuleId) => setSelectedRules(current => current.includes(id) ? current.filter(rule => rule !== id) : [...current, id])
  const testCompatible = (id: string) => {
    const challenge = CHALLENGES.find(item => item.id === id)
    if (!challenge) return false
    return selectedRules.every((ruleId, index) => isRuleCompatible(ruleId, selectedRules.slice(0, index).map(idValue => ({ id: idValue, activatedAt: 0, expiresAt: 99 })), challenge))
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'system', label: 'SYSTEM' }, { id: 'carnival', label: 'CARNIVAL' }, { id: 'records', label: 'RECORDS' }, { id: 'audio', label: 'AUDIO' },
    { id: 'display', label: 'DISPLAY' }, { id: 'playtest', label: 'PLAYTEST' }, { id: 'hardware', label: 'TOUCH CHECK' }, { id: 'stats', label: 'STATISTICS' },
  ]

  return (
    <main className="admin-screen">
      <aside className="admin-sidebar"><div><span>AUH-09</span><b>OPERATOR</b></div>{tabs.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}<button className="admin-close" onClick={onClose}>EXIT OPERATOR MODE</button></aside>
      <section className="admin-content">
        <header><div><span>LOCAL TERMINAL CONTROL</span><h1>{tabs.find(item => item.id === tab)?.label}</h1></div><b>CHANGES COMMIT AUTOMATICALLY</b></header>

        {tab === 'system' && <div className="admin-grid">
          <OperatorSection title="RUN CONTROL"><Toggle label="Verification service" note="Blocks new subject intake when disabled" value={settings.gameEnabled} onChange={value => patch({ gameEnabled: value })} /><Toggle label="Free play" note="Skip operator-issued attempts" value={settings.freePlay} onChange={value => patch({ freePlay: value })} /><Control label="Available attempts"><div className="stepper"><button onClick={() => patch({ credits: Math.max(0, settings.credits - 1) })}>-</button><b>{settings.credits}</b><button onClick={() => patch({ credits: settings.credits + settings.attemptsPerCredit })}>+ TOKEN</button></div></Control><Control label="Default tolerance"><input type="number" min="1" max="5" value={settings.defaultLives} onChange={event => patch({ defaultLives: Number(event.target.value) })} /></Control><Control label="Difficulty"><select value={settings.difficulty} onChange={event => patch({ difficulty: event.target.value as Difficulty })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></Control><Toggle label="Persistent conditions" note="Compatible requirements carry between tests" value={settings.persistentRules} onChange={value => patch({ persistentRules: value })} /></OperatorSection>
          <OperatorSection title="TERMINAL IDENTITY"><Control label="Title"><input maxLength={32} value={settings.title} onChange={event => patch({ title: event.target.value })} /></Control><Control label="Tagline"><input maxLength={80} value={settings.tagline} onChange={event => patch({ tagline: event.target.value })} /></Control><Control label="Standby copy"><input maxLength={80} value={settings.smallCopy} onChange={event => patch({ smallCopy: event.target.value })} /></Control><Control label="Operator PIN"><input inputMode="numeric" maxLength={8} value={settings.adminPin} onChange={event => patch({ adminPin: event.target.value.replace(/\D/g, '') || '9900' })} /></Control></OperatorSection>
        </div>}

        {tab === 'carnival' && <div className="admin-grid"><OperatorSection title="TOKEN MODEL"><Control label="Token label"><input value={settings.tokenLabel} onChange={event => patch({ tokenLabel: event.target.value.toUpperCase() })} /></Control><Control label="Standby price copy"><input value={settings.tokenPriceText} onChange={event => patch({ tokenPriceText: event.target.value.toUpperCase() })} /></Control><Control label="Attempts per token"><input type="number" min="1" max="5" value={settings.attemptsPerCredit} onChange={event => patch({ attemptsPerCredit: Number(event.target.value) })} /></Control></OperatorSection><OperatorSection title="DETERMINISTIC PRIZES">{settings.prizeTiers.map(tier => <div className="prize-control" key={tier.id}><button aria-pressed={tier.enabled} className={tier.enabled ? 'enabled' : ''} onClick={() => patch({ prizeTiers: settings.prizeTiers.map(item => item.id === tier.id ? { ...item, enabled: !item.enabled } : item) })}>{tier.enabled ? 'ON' : 'OFF'}</button><input aria-label={`${tier.name} name`} value={tier.name} onChange={event => patch({ prizeTiers: settings.prizeTiers.map(item => item.id === tier.id ? { ...item, name: event.target.value.toUpperCase() } : item) })} /><input aria-label={`${tier.name} threshold`} type="number" min="0" max="99.9" step="0.1" value={tier.threshold} onChange={event => patch({ prizeTiers: settings.prizeTiers.map(item => item.id === tier.id ? { ...item, threshold: Number(event.target.value) } : item) })} /><span>%</span></div>)}</OperatorSection></div>}

        {tab === 'records' && <div className="admin-grid"><OperatorSection title="RECORD POLICY"><Toggle label="Records enabled" value={settings.leaderboardEnabled} onChange={value => patch({ leaderboardEnabled: value })} /><Control label="Displayed rows"><input type="number" min="3" max="50" value={settings.leaderboardLength} onChange={event => patch({ leaderboardLength: Number(event.target.value) })} /></Control><Control label="Blocked identifiers"><textarea value={settings.blockedWords.join(', ')} onChange={event => patch({ blockedWords: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} /></Control><Control label="Identifier length"><input type="number" min="3" max="16" value={settings.nameMaxLength} onChange={event => patch({ nameMaxLength: Number(event.target.value) })} /></Control></OperatorSection><OperatorSection title={`LOCAL RECORDS // ${data.leaderboard.length}`}><div className="admin-actions"><button onClick={clearToday}>CLEAR TODAY</button><button onClick={clearAll}>CLEAR ALL TIME</button><button onClick={() => downloadJson(data)}>EXPORT JSON</button><button onClick={() => downloadCsv(data)}>EXPORT CSV</button></div><div className="mini-results">{sortLeaderboard(data.leaderboard).slice(0, 8).map(entry => <p key={entry.id}><b>{entry.name}</b><span>{entry.score.toFixed(2)}%</span></p>)}{!data.leaderboard.length && <p>NO LOCAL RECORDS</p>}</div></OperatorSection></div>}

        {tab === 'audio' && <div className="admin-grid"><OperatorSection title="PROCEDURAL DIAGNOSTIC AUDIO"><Toggle label="Mute all output" value={settings.muted} onChange={value => patch({ muted: value })} /><Range label="Master bus" value={settings.masterVolume} onChange={value => patch({ masterVolume: value })} /><Range label="Ambient bus" value={settings.musicVolume} onChange={value => patch({ musicVolume: value })} /><Range label="Status cues" value={settings.sfxVolume} onChange={value => patch({ sfxVolume: value })} /><p className="admin-note">Audio is generated locally. Browser policy unlocks the audio bus after direct contact.</p></OperatorSection></div>}

        {tab === 'display' && <div className="admin-grid"><OperatorSection title="KIOSK DISPLAY"><button className="admin-primary" onClick={onFullscreen}>TOGGLE FULLSCREEN DISPLAY</button><Toggle label="Reduced motion" value={settings.reducedMotion} onChange={value => patch({ reducedMotion: value })} /><Toggle label="High contrast" value={settings.highContrast} onChange={value => patch({ highContrast: value })} /><Range label="Interface scale" min={0.85} max={1.15} step={0.01} value={settings.screenScale} onChange={value => patch({ screenScale: value })} /><Control label="Standby demonstration delay"><input type="number" min="10" max="120" value={settings.attractTimeoutSeconds} onChange={event => patch({ attractTimeoutSeconds: Number(event.target.value) })} /></Control><Control label="Result / name timeout"><input type="number" min="10" max="120" value={settings.resultTimeoutSeconds} onChange={event => patch({ resultTimeoutSeconds: Number(event.target.value) })} /></Control></OperatorSection></div>}

        {tab === 'playtest' && <div className="debug-section">
          <div className="admin-grid"><OperatorSection title="PLAYTEST INSTRUMENTATION"><Toggle label="FPS / state overlay" value={settings.showFps} onChange={value => patch({ showFps: value })} /><Toggle label="Detailed contact markers" value={settings.touchVisualizer} onChange={value => patch({ touchVisualizer: value })} /><Control label="Deterministic seed"><input type="number" value={testSeed} onChange={event => setTestSeed(Number(event.target.value))} /></Control><button onClick={() => setTestSeed(Date.now())}>GENERATE NEW SEED</button>{lastTestSpec && <button className="admin-primary" onClick={() => onTestChallenge(lastTestSpec.id, lastTestSpec.difficulty, lastTestSpec.rules, lastTestSpec.seed)}>REPEAT LAST TEST</button>}<p className="admin-note">Live session conditions: {activeRules.length ? activeRules.map(id => RULES[id].name).join(', ') : 'none'}</p></OperatorSection><OperatorSection title="FORCED CONDITIONS"><div className="rule-selector">{(Object.keys(RULES) as RuleId[]).map(id => <button key={id} aria-pressed={selectedRules.includes(id)} className={selectedRules.includes(id) ? 'selected' : ''} onClick={() => toggleRule(id)}><span>{RULES[id].name}</span><small>{RULES[id].short}</small></button>)}</div></OperatorSection>{lastTestResult && <OperatorSection title="LAST RAW RESULT"><pre className="raw-result">{JSON.stringify(lastTestResult, null, 2)}</pre></OperatorSection>}</div>
          <div className="challenge-browser"><header><div><span>REGISTERED QA LIBRARY</span><h2>{filteredChallenges.length} CHALLENGE VARIANTS</h2></div><input aria-label="Filter challenges" placeholder="Filter by id, name, category" value={challengeFilter} onChange={event => setChallengeFilter(event.target.value)} /></header><div>{filteredChallenges.map(item => { const compatible = testCompatible(item.id); return <article key={item.id} className={compatible ? '' : 'incompatible'}><span>{item.category} // ROUND {item.minRound}+ // {item.variant}</span><h3>{item.name}</h3><p>{item.id}</p><small>{compatible ? item.instruction : 'SELECTED CONDITIONS ARE INCOMPATIBLE'}</small><div>{(['easy', 'medium', 'hard'] as Difficulty[]).map(difficulty => <button key={difficulty} disabled={!compatible} onClick={() => onTestChallenge(item.id, difficulty, selectedRules, testSeed)}>{difficulty.toUpperCase()}</button>)}</div></article> })}</div></div>
        </div>}

        {tab === 'hardware' && <TouchDiagnostics />}

        {tab === 'stats' && <div className="admin-grid stats-grid">{[['TOTAL PLAYS', stats.totalPlays], ['AVERAGE SCORE', `${stats.averageScore.toFixed(2)}%`], ['MEDIAN SCORE', `${stats.medianScore.toFixed(2)}%`], ['HIGHEST SCORE', `${stats.highestScore.toFixed(2)}%`], ['AVERAGE RUN', `${Math.round(stats.averageDurationMs / 1000)}s`]].map(([label, value]) => <div className="metric-card" key={label}><span>{label}</span><b>{value}</b></div>)}<OperatorSection title="CHALLENGE PERFORMANCE"><div className="stats-table"><p><b>CHALLENGE</b><b>ATTEMPTS</b><b>SUCCESS</b><b>FAILURES</b><b>AVG SCORE</b><b>AVG MEASURE</b></p>{stats.challenges.sort((a, b) => b.attempts - a.attempts).map(row => <p key={row.id}><span>{row.id}</span><span>{row.attempts}</span><span>{Math.round(row.completionRate * 100)}%</span><span>{row.failures}</span><span>{Math.round(row.averageAccuracy * 100)}%</span><span>{row.averageMeasurement === undefined ? '--' : row.averageMeasurement.toFixed(1)}</span></p>)}{!stats.challenges.length && <p>NO CHALLENGE DATA YET</p>}</div></OperatorSection><button onClick={() => { if (window.confirm('Reset aggregate challenge and run statistics?')) onData({ ...data, challengeStats: {}, totalPlays: 0, runDurations: [] }) }}>RESET AGGREGATE STATISTICS</button></div>}
      </section>
    </main>
  )
}

function OperatorSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="admin-card operator-section"><h2>{title}</h2>{children}</section> }
function Toggle({ label, note, value, onChange }: { label: string; note?: string; value: boolean; onChange: (value: boolean) => void }) { return <label className="admin-toggle"><span>{label}{note && <small>{note}</small>}</span><button type="button" aria-pressed={value} className={value ? 'on' : ''} onClick={() => onChange(!value)}>{value ? 'ON' : 'OFF'}</button></label> }
function Control({ label, children }: { label: string; children: React.ReactNode }) { return <label className="admin-control"><span>{label}</span>{children}</label> }
function Range({ label, value, onChange, min = 0, max = 1, step = 0.05 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) { return <label className="admin-range"><span>{label}</span><input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /><output>{Math.round(value * 100)}%</output></label> }
