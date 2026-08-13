import { useState } from 'react'
import type { LeaderboardEntry } from '../game/types'
import { sortLeaderboard, todayEntries } from '../storage/store'
import { HumanityLine, TerminalAction, TerminalFrame, TerminalHeader } from './terminal/TerminalPrimitives'

export function LeaderboardScreen({ entries, limit, onBack }: { entries: LeaderboardEntry[]; limit: number; onBack: () => void }) {
  const [mode, setMode] = useState<'today' | 'all'>('today')
  const visible = sortLeaderboard(mode === 'today' ? todayEntries(entries) : entries).slice(0, limit)
  return (
    <TerminalFrame state="records" className="leaderboard-screen">
      <TerminalHeader status="RECORDS ACCESS" humanity={visible[0]?.score ?? 0} />
      <header className="records-heading"><div><span>VERIFIED SUBJECTS // {mode === 'today' ? 'TODAY' : 'ALL TIME'}</span><h1>HUMAN RECORDS</h1></div><TerminalAction onClick={onBack}>RETURN TO STANDBY</TerminalAction></header>
      <div className="leaderboard-tabs" role="tablist"><button role="tab" aria-selected={mode === 'today'} className={mode === 'today' ? 'active' : ''} onClick={() => setMode('today')}>TODAY</button><button role="tab" aria-selected={mode === 'all'} className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>ALL TIME</button></div>
      <div className="leaderboard-table">
        <div className="leaderboard-row head"><span>RANK</span><span>SUBJECT IDENTIFIER</span><span>HUMANITY</span><span>TESTS</span><span>CHAIN</span></div>
        {visible.map((entry, index) => <div className={`leaderboard-row ${index < 3 ? `rank-${index + 1}` : ''}`} key={entry.id}><b>{String(index + 1).padStart(2, '0')}</b><strong>{entry.name}</strong><em>{entry.score.toFixed(2)}%</em><span>{String(entry.challenges).padStart(2, '0')}</span><span>{String(entry.bestCombo).padStart(2, '0')}</span></div>)}
        {!visible.length && <div className="leaderboard-empty">NO VERIFIED SUBJECTS <small>THE NEXT COMPLETED RUN SETS THE REFERENCE.</small></div>}
      </div>
      <HumanityLine value={visible[0]?.score ?? 0} tone="information" />
    </TerminalFrame>
  )
}
