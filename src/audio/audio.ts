import type { GameSettings } from '../game/types'

export type SoundName = 'tap' | 'start' | 'count' | 'success' | 'perfect' | 'error' | 'life' | 'rule' | 'expire' | 'warning' | 'result' | 'record'

interface ToneLayer {
  at: number
  duration: number
  frequency: number
  endFrequency?: number
  level: number
  type?: 'sine' | 'triangle'
}

interface RelayLayer {
  at: number
  level: number
  duration?: number
  center?: number
}

interface CueDefinition {
  gain: number
  tones: readonly ToneLayer[]
  relays?: readonly RelayLayer[]
}

interface ActiveVoice {
  nodes: AudioNode[]
  output: GainNode
  sources: AudioScheduledSourceNode[]
  remainingSources: number
  released: boolean
}

interface AmbientGraph {
  nodes: AudioNode[]
  sources: OscillatorNode[]
  output: GainNode
  low: OscillatorNode
  lowGain: GainNode
  harmonic: OscillatorNode
  harmonicGain: GainNode
  indicator: OscillatorNode
  indicatorGain: GainNode
  filter: BiquadFilterNode
  pulse: GainNode
  pulseLfo: OscillatorNode
  pulseDepth: GainNode
  remainingSources: number
  released: boolean
}

const SILENCE = 0.0001

// These are intentionally short, dry status sounds: relay contacts, calibrated
// oscillators, and measurement confirmations rather than arcade effects.
const cues: Record<SoundName, CueDefinition> = {
  tap: {
    gain: 0.42,
    tones: [{ at: 0, duration: 0.038, frequency: 690, endFrequency: 660, level: 0.2 }],
    relays: [{ at: 0, level: 0.13, duration: 0.014, center: 1_150 }],
  },
  start: {
    gain: 0.5,
    tones: [
      { at: 0, duration: 0.12, frequency: 174, endFrequency: 184, level: 0.28, type: 'triangle' },
      { at: 0.1, duration: 0.16, frequency: 262, endFrequency: 268, level: 0.22 },
    ],
    relays: [{ at: 0, level: 0.16 }, { at: 0.1, level: 0.11 }],
  },
  count: {
    gain: 0.4,
    tones: [{ at: 0, duration: 0.065, frequency: 470, endFrequency: 465, level: 0.25 }],
    relays: [{ at: 0, level: 0.12, center: 980 }],
  },
  success: {
    gain: 0.46,
    tones: [
      { at: 0, duration: 0.105, frequency: 470, endFrequency: 478, level: 0.2 },
      { at: 0.075, duration: 0.14, frequency: 635, endFrequency: 642, level: 0.23 },
    ],
    relays: [{ at: 0, level: 0.09 }],
  },
  perfect: {
    gain: 0.46,
    tones: [
      { at: 0, duration: 0.12, frequency: 515, level: 0.18 },
      { at: 0.075, duration: 0.15, frequency: 690, level: 0.2 },
      { at: 0.16, duration: 0.18, frequency: 805, level: 0.17 },
    ],
    relays: [{ at: 0, level: 0.1 }, { at: 0.16, level: 0.07 }],
  },
  error: {
    gain: 0.47,
    tones: [{ at: 0, duration: 0.22, frequency: 188, endFrequency: 138, level: 0.29, type: 'triangle' }],
    relays: [{ at: 0, level: 0.15, duration: 0.025, center: 460 }],
  },
  life: {
    gain: 0.52,
    tones: [
      { at: 0, duration: 0.26, frequency: 112, endFrequency: 86, level: 0.34, type: 'triangle' },
      { at: 0.09, duration: 0.16, frequency: 168, endFrequency: 126, level: 0.14 },
    ],
    relays: [{ at: 0, level: 0.16, center: 420 }, { at: 0.09, level: 0.11, center: 390 }],
  },
  rule: {
    gain: 0.44,
    tones: [
      { at: 0, duration: 0.1, frequency: 355, level: 0.2 },
      { at: 0.075, duration: 0.15, frequency: 505, level: 0.22 },
    ],
    relays: [{ at: 0, level: 0.13 }, { at: 0.075, level: 0.1 }],
  },
  expire: {
    gain: 0.4,
    tones: [{ at: 0, duration: 0.17, frequency: 425, endFrequency: 305, level: 0.22 }],
    relays: [{ at: 0.12, level: 0.09, center: 720 }],
  },
  warning: {
    gain: 0.44,
    tones: [
      { at: 0, duration: 0.07, frequency: 245, level: 0.24, type: 'triangle' },
      { at: 0.11, duration: 0.07, frequency: 245, level: 0.24, type: 'triangle' },
    ],
    relays: [{ at: 0, level: 0.13, center: 650 }, { at: 0.11, level: 0.13, center: 650 }],
  },
  result: {
    gain: 0.47,
    tones: [
      { at: 0, duration: 0.15, frequency: 286, level: 0.2 },
      { at: 0.12, duration: 0.17, frequency: 382, level: 0.2 },
      { at: 0.24, duration: 0.24, frequency: 510, level: 0.2 },
    ],
    relays: [{ at: 0, level: 0.11 }, { at: 0.24, level: 0.08 }],
  },
  record: {
    gain: 0.45,
    tones: [
      { at: 0, duration: 0.18, frequency: 420, level: 0.17 },
      { at: 0.12, duration: 0.2, frequency: 560, level: 0.18 },
      { at: 0.24, duration: 0.23, frequency: 700, level: 0.18 },
      { at: 0.37, duration: 0.32, frequency: 840, level: 0.16 },
    ],
    relays: [{ at: 0, level: 0.1 }, { at: 0.37, level: 0.07 }],
  },
}

function clampUnit(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

class GameAudio {
  private context?: AudioContext
  private settings?: GameSettings
  private masterBus?: GainNode
  private musicBus?: GainNode
  private sfxBus?: GainNode
  private limiter?: DynamicsCompressorNode
  private ambient?: AmbientGraph
  private noiseBuffer?: AudioBuffer
  private activeVoices = new Set<ActiveVoice>()
  private ambientRequested = false
  private intensity = 0.12
  private paused = false

  configure(settings: GameSettings) {
    this.settings = settings
    this.updateBusLevels(0.08)

    if (this.context?.state === 'suspended' && !settings.muted && !this.paused) {
      void this.context.resume().catch(() => undefined)
    }
  }

  unlock(settings: GameSettings) {
    this.settings = settings

    if (!this.context) {
      const WebkitAudioContext = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      const AudioContextConstructor = window.AudioContext ?? WebkitAudioContext
      if (!AudioContextConstructor) return

      this.context = new AudioContextConstructor({ latencyHint: 'interactive' })
      this.createBuses()
    }

    this.updateBusLevels(0.02)
    if (this.ambientRequested && !this.ambient) this.createAmbient()
    void this.context.resume().catch(() => undefined)
  }

  play(name: SoundName) {
    const context = this.context
    const sfxBus = this.sfxBus
    if (!context || !sfxBus || !this.settings || this.settings.muted || this.paused) return

    const cue = cues[name]
    const startAt = context.currentTime + 0.004
    const output = context.createGain()
    output.gain.setValueAtTime(cue.gain, startAt)
    output.connect(sfxBus)

    const voice: ActiveVoice = {
      nodes: [output],
      output,
      sources: [],
      remainingSources: 0,
      released: false,
    }

    for (const tone of cue.tones) this.scheduleTone(voice, tone, startAt)
    for (const relay of cue.relays ?? []) this.scheduleRelay(voice, relay, startAt)
    this.registerVoice(voice)
  }

  startAmbient() {
    this.ambientRequested = true
    if (!this.context || !this.musicBus || this.ambient) return
    this.createAmbient()
  }

  stopAmbient() {
    this.ambientRequested = false
    const graph = this.ambient
    const context = this.context
    if (!graph || !context) return

    this.ambient = undefined
    const now = context.currentTime
    this.holdAndRamp(graph.output.gain, SILENCE, 0.16, now)
    for (const source of graph.sources) {
      try {
        source.stop(now + 0.19)
      } catch {
        // A source can already have ended while the page is being torn down.
      }
    }
  }

  /** Morphs the running ambience without rebuilding or restarting its graph. */
  setIntensity(level: number) {
    this.intensity = clampUnit(level)
    if (this.ambient) this.updateAmbient(this.ambient, 0.32)
  }

  /** Temporarily silences all buses while preserving the ambient pulse phase. */
  setPaused(paused: boolean) {
    this.paused = paused
    this.updateBusLevels(paused ? 0.035 : 0.12)

    if (!paused && this.context?.state === 'suspended' && !this.settings?.muted) {
      void this.context.resume().catch(() => undefined)
    }
  }

  /** Stops every transient voice and releases the ambient graph. */
  silence() {
    this.stopAmbient()
    const context = this.context
    if (!context) return

    const now = context.currentTime
    for (const voice of this.activeVoices) {
      this.holdAndRamp(voice.output.gain, SILENCE, 0.025, now)
      for (const source of voice.sources) {
        try {
          source.stop(now + 0.035)
        } catch {
          // The voice may already be inside its natural release.
        }
      }
    }
  }

  private createBuses() {
    const context = this.context
    if (!context || this.masterBus) return

    const masterBus = context.createGain()
    const musicBus = context.createGain()
    const sfxBus = context.createGain()
    const limiter = context.createDynamicsCompressor()

    masterBus.gain.value = 0
    musicBus.gain.value = 0
    sfxBus.gain.value = 0
    limiter.threshold.value = -12
    limiter.knee.value = 10
    limiter.ratio.value = 4
    limiter.attack.value = 0.004
    limiter.release.value = 0.18

    musicBus.connect(masterBus)
    sfxBus.connect(masterBus)
    masterBus.connect(limiter)
    limiter.connect(context.destination)

    this.masterBus = masterBus
    this.musicBus = musicBus
    this.sfxBus = sfxBus
    this.limiter = limiter
  }

  private updateBusLevels(duration: number) {
    const context = this.context
    const settings = this.settings
    if (!context || !settings || !this.masterBus || !this.musicBus || !this.sfxBus) return

    const masterLevel = settings.muted || this.paused ? 0 : clampUnit(settings.masterVolume)
    const now = context.currentTime
    this.holdAndRamp(this.masterBus.gain, masterLevel, duration, now)
    this.holdAndRamp(this.musicBus.gain, clampUnit(settings.musicVolume), duration, now)
    this.holdAndRamp(this.sfxBus.gain, clampUnit(settings.sfxVolume), duration, now)
  }

  private scheduleTone(voice: ActiveVoice, layer: ToneLayer, baseTime: number) {
    const context = this.context
    if (!context) return

    const start = baseTime + layer.at
    const end = start + layer.duration
    const attack = Math.min(0.008, layer.duration * 0.22)
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = layer.type ?? 'sine'
    oscillator.frequency.setValueAtTime(Math.max(20, layer.frequency), start)
    if (layer.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, layer.endFrequency), end)
    }

    gain.gain.setValueAtTime(SILENCE, start)
    gain.gain.linearRampToValueAtTime(layer.level, start + attack)
    gain.gain.exponentialRampToValueAtTime(SILENCE, end)
    oscillator.connect(gain)
    gain.connect(voice.output)
    oscillator.start(start)
    oscillator.stop(end + 0.012)

    voice.nodes.push(oscillator, gain)
    voice.sources.push(oscillator)
  }

  private scheduleRelay(voice: ActiveVoice, layer: RelayLayer, baseTime: number) {
    const context = this.context
    if (!context) return

    const duration = layer.duration ?? 0.018
    const start = baseTime + layer.at
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()

    source.buffer = this.getNoiseBuffer()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(layer.center ?? 900, start)
    filter.Q.value = 0.72
    gain.gain.setValueAtTime(layer.level, start)
    gain.gain.exponentialRampToValueAtTime(SILENCE, start + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(voice.output)
    source.start(start, 0, duration)

    voice.nodes.push(source, filter, gain)
    voice.sources.push(source)
  }

  private registerVoice(voice: ActiveVoice) {
    if (voice.sources.length === 0) {
      this.releaseVoice(voice)
      return
    }

    voice.remainingSources = voice.sources.length
    this.activeVoices.add(voice)
    for (const source of voice.sources) {
      source.onended = () => {
        voice.remainingSources -= 1
        if (voice.remainingSources === 0) this.releaseVoice(voice)
      }
    }
  }

  private releaseVoice(voice: ActiveVoice) {
    if (voice.released) return
    voice.released = true
    this.activeVoices.delete(voice)
    for (const source of voice.sources) source.onended = null
    for (const node of voice.nodes) node.disconnect()
    voice.nodes.length = 0
    voice.sources.length = 0
  }

  private getNoiseBuffer() {
    const context = this.context
    if (!context) throw new Error('Audio context is unavailable')
    if (this.noiseBuffer) return this.noiseBuffer

    const sampleCount = Math.ceil(context.sampleRate * 0.04)
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
    const channel = buffer.getChannelData(0)
    let seed = 0x4d3a2b1c
    for (let index = 0; index < channel.length; index += 1) {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) | 0
      channel[index] = ((seed >>> 0) / 0xffff_ffff) * 2 - 1
    }
    this.noiseBuffer = buffer
    return buffer
  }

  private createAmbient() {
    const context = this.context
    const musicBus = this.musicBus
    if (!context || !musicBus || this.ambient) return

    const output = context.createGain()
    const pulse = context.createGain()
    const filter = context.createBiquadFilter()
    const low = context.createOscillator()
    const lowGain = context.createGain()
    const harmonic = context.createOscillator()
    const harmonicGain = context.createGain()
    const indicator = context.createOscillator()
    const indicatorFilter = context.createBiquadFilter()
    const indicatorGain = context.createGain()
    const pulseLfo = context.createOscillator()
    const pulseDepth = context.createGain()

    output.gain.value = SILENCE
    pulse.gain.value = 0.67
    filter.type = 'lowpass'
    filter.Q.value = 0.78
    low.type = 'sine'
    harmonic.type = 'sine'
    indicator.type = 'triangle'
    indicatorFilter.type = 'bandpass'
    indicatorFilter.frequency.value = 285
    indicatorFilter.Q.value = 1.2
    pulseLfo.type = 'sine'

    low.connect(lowGain)
    lowGain.connect(filter)
    harmonic.connect(harmonicGain)
    harmonicGain.connect(filter)
    indicator.connect(indicatorFilter)
    indicatorFilter.connect(indicatorGain)
    indicatorGain.connect(filter)
    filter.connect(pulse)
    pulseLfo.connect(pulseDepth)
    pulseDepth.connect(pulse.gain)
    pulse.connect(output)
    output.connect(musicBus)

    const sources = [low, harmonic, indicator, pulseLfo]
    const graph: AmbientGraph = {
      nodes: [
        output,
        pulse,
        filter,
        low,
        lowGain,
        harmonic,
        harmonicGain,
        indicator,
        indicatorFilter,
        indicatorGain,
        pulseLfo,
        pulseDepth,
      ],
      sources,
      output,
      low,
      lowGain,
      harmonic,
      harmonicGain,
      indicator,
      indicatorGain,
      filter,
      pulse,
      pulseLfo,
      pulseDepth,
      remainingSources: sources.length,
      released: false,
    }

    for (const source of sources) {
      source.onended = () => {
        graph.remainingSources -= 1
        if (graph.remainingSources === 0) this.releaseAmbient(graph)
      }
      source.start()
    }

    this.ambient = graph
    this.updateAmbient(graph, 0.42)
  }

  private updateAmbient(graph: AmbientGraph, duration: number) {
    const context = this.context
    if (!context) return

    const intensity = this.intensity
    const now = context.currentTime
    const lowFrequency = 52 + intensity * 5
    this.holdAndRamp(graph.low.frequency, lowFrequency, duration, now)
    this.holdAndRamp(graph.harmonic.frequency, lowFrequency * 2, duration, now)
    this.holdAndRamp(graph.indicator.frequency, 232 + intensity * 34, duration, now)
    this.holdAndRamp(graph.lowGain.gain, 0.17 + intensity * 0.09, duration, now)
    this.holdAndRamp(graph.harmonicGain.gain, 0.038 + intensity * 0.05, duration, now)
    this.holdAndRamp(graph.indicatorGain.gain, 0.004 + intensity * 0.014, duration, now)
    this.holdAndRamp(graph.filter.frequency, 250 + intensity * 240, duration, now)
    this.holdAndRamp(graph.pulseLfo.frequency, 0.3 + intensity * 0.78, duration, now)
    this.holdAndRamp(graph.pulseDepth.gain, 0.07 + intensity * 0.14, duration, now)
    this.holdAndRamp(graph.output.gain, 0.2 + intensity * 0.1, duration, now)
  }

  private releaseAmbient(graph: AmbientGraph) {
    if (graph.released) return
    graph.released = true
    if (this.ambient === graph) this.ambient = undefined
    for (const source of graph.sources) source.onended = null
    for (const node of graph.nodes) node.disconnect()
    graph.nodes.length = 0
    graph.sources.length = 0
  }

  private holdAndRamp(parameter: AudioParam, value: number, duration: number, now: number) {
    try {
      parameter.cancelAndHoldAtTime(now)
    } catch {
      const current = parameter.value
      parameter.cancelScheduledValues(now)
      parameter.setValueAtTime(current, now)
    }
    parameter.linearRampToValueAtTime(value, now + duration)
  }
}

export const gameAudio = new GameAudio()
