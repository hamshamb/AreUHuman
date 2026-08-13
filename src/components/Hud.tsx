import { calculateLiveScore } from '../game/engine/scoring'
import type { SessionPerformance } from '../game/types'

export function Hud({ session, subjectId }: { session: SessionPerformance; subjectId: string }) {
  return (
    <div className="game-hud" aria-label={`Humanity ${calculateLiveScore(session).toFixed(2)} percent. ${session.lives} tolerance remaining. Response chain ${session.combo}.`}>
      <div className="hud-subject"><span>SUBJECT</span><b>{subjectId.replace('SUBJECT_', '')}</b></div>
      <div className="hud-score"><span>HUMANITY</span><b>{calculateLiveScore(session).toFixed(2)}<i>%</i></b></div>
      <div className="hud-combo"><span>RESPONSE CHAIN</span><b>{String(session.combo).padStart(2, '0')}</b></div>
      <div className="hud-lives"><span>TOLERANCE</span><b>{String(session.lives).padStart(2, '0')}<i> / {String(session.maxLives).padStart(2, '0')}</i></b></div>
    </div>
  )
}
