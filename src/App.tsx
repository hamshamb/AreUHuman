import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AdminPanel } from './components/AdminPanel'
import { AdminPin } from './components/AdminPin'
import { AttractScreen } from './components/AttractScreen'
import { BootScreen } from './components/BootScreen'
import { ChallengeArena } from './components/challenges/ChallengeArena'
import { FeedbackOverlay } from './components/FeedbackOverlay'
import { FpsOverlay } from './components/FpsOverlay'
import { Hud } from './components/Hud'
import { LeaderboardScreen } from './components/LeaderboardScreen'
import { NameEntryScreen } from './components/NameEntryScreen'
import { ReadyScreen } from './components/ReadyScreen'
import { ResultScreen } from './components/ResultScreen'
import { SetupScreen } from './components/SetupScreen'
import { gameAudio } from './audio/audio'
import { getChallenge } from './game/challenges/catalog'
import { MAX_ROUNDS } from './game/config'
import { challengeTier, selectChallenge } from './game/engine/selection'
import { calculateFinalScore, closestMeasuredMiss, getPrize, getScoreBand, meanAccuracy, sanitizeName } from './game/engine/scoring'
import { subjectIdFromSeed } from './game/presentation'
import { expireRules, maybeAddRule } from './game/rules/rules'
import type { ActiveRule, ChallengeDefinition, ChallengeResult, ChallengeTestSpec, Difficulty, GameSettings, LeaderboardEntry, PersistedData, RuleId, SessionPerformance, SessionSummary } from './game/types'
import { compareLeaderboardEntries, loadData, normalizeSettings, recordChallenge, resetSession, saveData, sortLeaderboard, todayEntries } from './storage/store'

type View = 'boot' | 'attract' | 'ready' | 'playing' | 'name' | 'result' | 'leaderboard' | 'pin' | 'admin'

export default function App() {
  const [data, setData] = useState<PersistedData>(() => loadData())
  const [view, setView] = useState<View>(data.setupComplete ? 'boot' : 'attract')
  const [showSetup, setShowSetup] = useState(!data.setupComplete)
  const [session, setSession] = useState<SessionPerformance>()
  const [challenge, setChallenge] = useState<ChallengeDefinition>()
  const [feedback, setFeedback] = useState<ChallengeResult>()
  const [summary, setSummary] = useState<SessionSummary>()
  const [testMode, setTestMode] = useState(false)
  const [testDifficulty, setTestDifficulty] = useState<Difficulty>('medium')
  const [lastTestSpec, setLastTestSpec] = useState<ChallengeTestSpec>()
  const [lastTestResult, setLastTestResult] = useState<ChallengeResult>()
  const [livePointers, setLivePointers] = useState(0)
  const [systemNotice, setSystemNotice] = useState<string>()
  const transitionTimer = useRef<number | undefined>(undefined)
  const noticeTimer = useRef<number | undefined>(undefined)
  const wakeLock = useRef<{ release: () => Promise<void> } | undefined>(undefined)
  const settings = data.settings

  const unlockAudio = useCallback(() => {
    gameAudio.unlock(settings)
    gameAudio.startAmbient()
  }, [settings])

  const schedule = useCallback((callback: () => void, delay: number) => {
    window.clearTimeout(transitionTimer.current)
    transitionTimer.current = window.setTimeout(callback, delay)
  }, [])

  const notify = useCallback((message: string) => {
    window.clearTimeout(noticeTimer.current)
    setSystemNotice(message)
    noticeTimer.current = window.setTimeout(() => setSystemNotice(undefined), 2600)
  }, [])

  useEffect(() => { saveData(data) }, [data])
  useEffect(() => { gameAudio.configure(settings) }, [settings])
  useEffect(() => {
    document.documentElement.dataset.contrast = settings.highContrast ? 'high' : 'normal'
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full'
    document.documentElement.style.setProperty('--screen-scale', String(settings.screenScale))
  }, [settings.highContrast, settings.reducedMotion, settings.screenScale])
  useEffect(() => {
    const round = (session?.completed ?? 0) + (session?.failures ?? 0)
    gameAudio.setIntensity(view === 'playing' ? Math.min(1, 0.12 + round / MAX_ROUNDS * 0.88) : 0.08)
  }, [session?.completed, session?.failures, view])
  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) void navigator.serviceWorker.register('/sw.js')
  }, [])
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (view === 'playing') event.preventDefault() }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [view])
  useEffect(() => {
    const operatorShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a' && view === 'attract') {
        event.preventDefault()
        setView('pin')
      }
    }
    window.addEventListener('keydown', operatorShortcut)
    return () => window.removeEventListener('keydown', operatorShortcut)
  }, [view])
  useEffect(() => {
    if (view !== 'attract' || settings.attractTimeoutSeconds <= 0) return
    let idleTimer: number | undefined
    const arm = () => {
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => notify('STANDBY DEMONSTRATION // PLACE HAND TO VERIFY'), settings.attractTimeoutSeconds * 1000)
    }
    const activity = () => arm()
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown']
    events.forEach(event => window.addEventListener(event, activity))
    arm()
    return () => {
      window.clearTimeout(idleTimer)
      events.forEach(event => window.removeEventListener(event, activity))
    }
  }, [notify, settings.attractTimeoutSeconds, view])
  useEffect(() => () => {
    window.clearTimeout(transitionTimer.current)
    window.clearTimeout(noticeTimer.current)
    void wakeLock.current?.release()
    gameAudio.silence()
  }, [])

  const updateSettings = (next: GameSettings) => setData(previous => ({ ...previous, settings: normalizeSettings(next) }))

  const beginGame = useCallback(() => {
    if (!settings.gameEnabled || (!settings.freePlay && settings.credits <= 0)) return
    gameAudio.unlock(settings)
    gameAudio.startAmbient()
    gameAudio.play('start')
    const fresh = resetSession(settings.defaultLives, Date.now())
    setData(previous => ({ ...previous, settings: previous.settings.freePlay ? previous.settings : { ...previous.settings, credits: Math.max(0, previous.settings.credits - 1) } }))
    setSession(fresh)
    setChallenge(selectChallenge(fresh, settings.difficulty))
    setFeedback(undefined)
    setSummary(undefined)
    setTestMode(false)
    setLivePointers(0)
    setView('ready')
  }, [settings])

  const goHome = useCallback(() => {
    window.clearTimeout(transitionTimer.current)
    setFeedback(undefined)
    setSession(undefined)
    setChallenge(undefined)
    setSummary(undefined)
    setTestMode(false)
    setLivePointers(0)
    setView('attract')
    gameAudio.startAmbient()
  }, [])

  const finishSession = useCallback((finished: SessionPerformance) => {
    const durationMs = Date.now() - finished.startedAt
    const score = calculateFinalScore(finished)
    const today = sortLeaderboard(todayEntries(data.leaderboard))
    const leaderboardCandidate = { score, challenges: finished.completed, durationMs }
    const bestTiming = finished.results.flatMap(result => result.metrics?.timingErrorMs === undefined ? [] : [result.metrics.timingErrorMs]).sort((a, b) => a - b)[0]
    const rankToday = 1 + today.filter(entry => compareLeaderboardEntries(entry, leaderboardCandidate) < 0).length
    const result: SessionSummary = {
      subjectId: subjectIdFromSeed(finished.seed),
      score,
      category: getScoreBand(score, settings.scoreBands),
      prize: getPrize(score, settings.prizeTiers),
      completed: finished.completed,
      bestCombo: finished.bestCombo,
      precision: meanAccuracy(finished),
      durationMs,
      nearestMiss: closestMeasuredMiss(finished) ?? finished.nearestMiss,
      rankToday,
      isPersonalBest: score > data.personalBest,
      isNewStandard: !today[0] || compareLeaderboardEntries(leaderboardCandidate, today[0]) < 0,
      failures: finished.failures,
      endReason: finished.lives <= 0 ? 'tolerance-exhausted' : 'completed',
      bestTimingErrorMs: bestTiming,
    }
    setSummary(result)
    setData(previous => ({ ...previous, totalPlays: previous.totalPlays + 1, personalBest: Math.max(previous.personalBest, score), runDurations: [...previous.runDurations.slice(-199), durationMs] }))
    const cutoff = today.slice(0, settings.leaderboardLength).at(-1)
    const qualifies = settings.leaderboardEnabled && (today.length < settings.leaderboardLength || !cutoff || compareLeaderboardEntries(leaderboardCandidate, cutoff) < 0)
    gameAudio.play(result.isNewStandard ? 'record' : 'result')
    setView(qualifies ? 'name' : 'result')
  }, [data.leaderboard, data.personalBest, settings.leaderboardEnabled, settings.leaderboardLength, settings.prizeTiers, settings.scoreBands])

  const advance = useCallback((updated: SessionPerformance) => {
    const round = updated.completed + updated.failures
    const expired = expireRules(updated.activeRules, round)
    if (expired.length < updated.activeRules.length) gameAudio.play('expire')
    const proposedRules = settings.persistentRules ? maybeAddRule(expired, round, updated.seed) : []
    if (proposedRules.length > expired.length) gameAudio.play('rule')
    let nextSession = { ...updated, activeRules: proposedRules }
    let nextChallenge: ChallengeDefinition
    try {
      nextChallenge = selectChallenge(nextSession, settings.difficulty)
    } catch {
      nextSession = { ...updated, activeRules: expired }
      nextChallenge = selectChallenge(nextSession, settings.difficulty)
    }
    setSession(nextSession)
    setChallenge(nextChallenge)
    setFeedback(undefined)
  }, [settings.difficulty, settings.persistentRules])

  const handleResult = useCallback((result: ChallengeResult) => {
    if (!session || !challenge || feedback) return
    setFeedback(result)
    gameAudio.play(result.success ? (result.accuracy > 0.95 ? 'perfect' : 'success') : 'life')
    if (navigator.vibrate) navigator.vibrate(result.success ? 18 : [35, 25, 35])
    setData(previous => recordChallenge(previous, challenge.id, result))

    if (testMode) {
      setLastTestResult(result)
      schedule(() => { setFeedback(undefined); setView('admin') }, 1100)
      return
    }

    const combo = result.success ? session.combo + 1 : 0
    const missValue = result.normalizedMiss ?? Number.POSITIVE_INFINITY
    const isCloserMiss = !result.success && result.detail && missValue < (session.nearestMissValue ?? Number.POSITIVE_INFINITY)
    const updated: SessionPerformance = {
      ...session,
      completed: session.completed + (result.success ? 1 : 0),
      failures: session.failures + (result.success ? 0 : 1),
      lives: session.lives - (result.success ? 0 : 1),
      combo,
      bestCombo: Math.max(session.bestCombo, combo),
      accuracyTotal: session.accuracyTotal + result.accuracy,
      lastGesture: challenge.gesture,
      recentChallengeIds: [...session.recentChallengeIds.slice(-7), challenge.id],
      recentCategories: [...session.recentCategories.slice(-5), challenge.category],
      results: [...session.results, result],
      nearestMiss: isCloserMiss ? result.detail : session.nearestMiss,
      nearestMissValue: isCloserMiss ? missValue : session.nearestMissValue,
    }
    setSession(updated)
    const runFinished = updated.lives <= 0 || updated.completed >= MAX_ROUNDS
    schedule(() => runFinished ? finishSession(updated) : advance(updated), result.success ? 620 : 940)
  }, [advance, challenge, feedback, finishSession, schedule, session, testMode])

  const saveScore = useCallback((rawName: string) => {
    if (!summary) return
    const name = sanitizeName(rawName, settings)
    const entry: LeaderboardEntry = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      name,
      score: summary.score,
      createdAt: new Date().toISOString(),
      challenges: summary.completed,
      bestCombo: summary.bestCombo,
      precision: summary.precision,
      durationMs: summary.durationMs,
    }
    setData(previous => ({ ...previous, leaderboard: sortLeaderboard([...previous.leaderboard, entry]).slice(0, 500) }))
    setView('result')
  }, [settings, summary])

  const testChallenge = useCallback((id: string, difficulty: Difficulty, rules: RuleId[] = [], seed = Date.now()) => {
    const selected = getChallenge(id)
    if (!selected) return
    gameAudio.unlock(settings)
    const activeRules: ActiveRule[] = rules.map(ruleId => ({ id: ruleId, activatedAt: 0, expiresAt: 999, memoryValue: ruleId === 'remember-star' ? 7 : undefined }))
    const fresh = { ...resetSession(5, seed), activeRules }
    setTestMode(true)
    setTestDifficulty(difficulty)
    setLastTestSpec({ id, difficulty, rules, seed })
    setSession(fresh)
    setChallenge(selected)
    setFeedback(undefined)
    setLivePointers(0)
    setView('playing')
  }, [settings])

  const fullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
        if (nav.wakeLock) wakeLock.current = await nav.wakeLock.request('screen')
        notify('DISPLAY MODE ACTIVE')
      } else {
        await wakeLock.current?.release()
        wakeLock.current = undefined
        await document.exitFullscreen()
        notify('DISPLAY MODE RELEASED')
      }
    } catch {
      notify('DISPLAY MODE UNAVAILABLE / BROWSER RESTRICTION')
    }
  }

  const averageDuration = useMemo(() => data.runDurations.length ? data.runDurations.reduce((sum, value) => sum + value, 0) / data.runDurations.length : undefined, [data.runDurations])
  const tier = testMode ? (testDifficulty === 'easy' ? 1 : testDifficulty === 'medium' ? 2 : 3) : challengeTier(session?.completed ?? 0, settings.difficulty)
  const subjectId = session ? subjectIdFromSeed(session.seed) : undefined

  if (showSetup) return <SetupScreen settings={settings} onComplete={next => { const normalized = normalizeSettings(next); setData(previous => ({ ...previous, setupComplete: true, settings: normalized })); setShowSetup(false); setView('boot'); gameAudio.unlock(normalized); gameAudio.startAmbient() }} />

  return (
    <div className="app-shell" onPointerDownCapture={unlockAudio}>
      <div className="rotate-notice"><span>AUH-09</span><h1>DISPLAY ORIENTATION INVALID</h1><p>Rotate the device 90 degrees to continue verification.</p></div>
      {view === 'boot' && <BootScreen onComplete={() => setView('attract')} />}
      {view === 'attract' && <AttractScreen settings={settings} leaderboard={data.leaderboard} averageDurationMs={averageDuration} onStart={beginGame} onLeaderboard={() => setView('leaderboard')} onAdmin={() => setView('pin')} onFullscreen={fullscreen} />}
      {view === 'ready' && session && subjectId && <ReadyScreen lives={session.maxLives} subjectId={subjectId} onComplete={() => setView('playing')} />}
      {view === 'playing' && session && challenge && subjectId && <>
        <ChallengeArena key={`${challenge.id}-${session.completed}-${session.failures}`} challenge={challenge} tier={tier} seed={session.seed} round={session.completed + session.failures} session={session} subjectId={subjectId} activeRules={session.activeRules} touchVisualizer={settings.touchVisualizer} onPointerCountChange={setLivePointers} onResult={handleResult} />
        <Hud session={session} subjectId={subjectId} />
        {feedback && <FeedbackOverlay result={feedback} />}
        {settings.showFps && <FpsOverlay pointers={livePointers} challenge={challenge.id} difficulty={`TIER ${tier}`} rules={session.activeRules.map(rule => rule.id)} />}
      </>}
      {view === 'name' && summary && <NameEntryScreen summary={summary} settings={settings} timeoutSeconds={settings.resultTimeoutSeconds} onSubmit={saveScore} />}
      {view === 'result' && summary && <ResultScreen summary={summary} timeoutSeconds={settings.resultTimeoutSeconds} onReplay={beginGame} onLeaderboard={() => setView('leaderboard')} onHome={goHome} />}
      {view === 'leaderboard' && <LeaderboardScreen entries={data.leaderboard} limit={settings.leaderboardLength} onBack={goHome} />}
      {view === 'pin' && <><AttractScreen settings={settings} leaderboard={data.leaderboard} averageDurationMs={averageDuration} onStart={beginGame} onLeaderboard={() => setView('leaderboard')} onAdmin={() => undefined} onFullscreen={fullscreen} /><AdminPin expected={settings.adminPin} onSuccess={() => setView('admin')} onCancel={goHome} /></>}
      {view === 'admin' && <AdminPanel data={data} activeRules={session?.activeRules.map(rule => rule.id) ?? []} lastTestSpec={lastTestSpec} lastTestResult={lastTestResult} onSettings={updateSettings} onData={setData} onTestChallenge={testChallenge} onFullscreen={fullscreen} onClose={goHome} />}
      {systemNotice && <div className="system-notice" role="status">{systemNotice}</div>}
    </div>
  )
}
