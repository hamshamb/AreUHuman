import type { ChallengeResult } from '../game/types'
import { MeasurementValue, VerificationStamp } from './terminal/TerminalPrimitives'

function primaryMetric(result: ChallengeResult): { label: string; value: string; unit?: string } | undefined {
  const metrics = result.metrics
  if (metrics?.simultaneousDeltaMs !== undefined) return { label: 'CONTACT DELTA', value: Math.round(metrics.simultaneousDeltaMs).toString(), unit: 'ms' }
  if (metrics?.timingErrorMs !== undefined) return { label: 'TIMING ERROR', value: Math.round(metrics.timingErrorMs).toString(), unit: 'ms' }
  if (metrics?.precisionErrorPx !== undefined) return { label: 'PRECISION ERROR', value: metrics.precisionErrorPx.toFixed(1), unit: 'px' }
  if (metrics?.maxPathErrorPx !== undefined) return { label: 'MAXIMUM DRIFT', value: metrics.maxPathErrorPx.toFixed(1), unit: 'px' }
  if (metrics?.swipeAngleErrorDeg !== undefined) return { label: 'ANGULAR ERROR', value: metrics.swipeAngleErrorDeg.toFixed(1), unit: 'deg' }
  if (metrics?.swipeVelocityPxPerSecond !== undefined) return { label: 'VELOCITY', value: Math.round(metrics.swipeVelocityPxPerSecond).toString(), unit: 'px/s' }
  if (metrics?.revealedPercent !== undefined) return { label: 'SURFACE REVEALED', value: metrics.revealedPercent.toFixed(1), unit: '%' }
  if (metrics?.reactionMs !== undefined) return { label: 'RESPONSE TIME', value: Math.round(metrics.reactionMs).toString(), unit: 'ms' }
  if (result.measurement !== undefined) return { label: 'MEASURED VALUE', value: Number(result.measurement).toFixed(1) }
  return undefined
}

export function FeedbackOverlay({ result }: { result: ChallengeResult }) {
  const metric = primaryMetric(result)
  const perfect = result.success && result.accuracy >= 0.97
  const tone = result.success ? 'verified' : 'failure'
  return (
    <div className={`feedback-overlay ${result.success ? 'success' : 'failure'} ${perfect ? 'perfect' : ''}`} role="status" aria-live="assertive">
      <div className="feedback-overlay__rail"><span>{result.success ? 'INPUT ACCEPTED' : 'INPUT REJECTED'}</span><i /></div>
      <section>
        <VerificationStamp label={result.success ? perfect ? 'PRECISE.' : 'VERIFIED' : 'INVALID'} tone={tone} />
        <h2>{result.message}</h2>
        {metric && <MeasurementValue label={metric.label} value={metric.value} unit={metric.unit} tone={tone} hero />}
        {result.detail && <p>{result.detail}</p>}
      </section>
      <div className="feedback-overlay__status"><span>HUMAN RESPONSE</span><b>{result.success ? 'CONSISTENT' : 'INCONSISTENT'}</b></div>
    </div>
  )
}
