import type { SpeechHost } from '../platform'

export interface FakeVoice {
  readonly lang: string
  readonly name: string
}

export interface FakeUtterance {
  readonly text: string
  lang: string
  rate: number
  voice: FakeVoice | null
}

export interface FakeSpeechOptions {
  /** `speak` throws (a broken speech engine). */
  readonly throwOnSpeak?: boolean
}

/**
 * Stand-in for `speechSynthesis` and `SpeechSynthesisUtterance` (jsdom has neither): records the calls
 * and the spoken utterances. `host` goes to the platform speech functions or onto `window`.
 */
export function fakeSpeech(voices: readonly FakeVoice[], options: FakeSpeechOptions = {}) {
  const calls: string[] = []
  const spoken: FakeUtterance[] = []
  let voicesAsked = 0

  class Utterance implements FakeUtterance {
    lang = ''
    rate = 1
    voice: FakeVoice | null = null
    readonly text: string
    constructor(text: string) {
      this.text = text
    }
  }

  const synth = {
    cancel: () => {
      calls.push('cancel')
    },
    speak: (u: FakeUtterance) => {
      calls.push('speak')
      if (options.throwOnSpeak) throw new Error('speech failed')
      spoken.push(u)
    },
    getVoices: () => {
      voicesAsked++
      return voices
    },
    addEventListener: (type: string) => {
      calls.push(`addEventListener:${type}`)
    },
  }

  const host = {
    speechSynthesis: synth as unknown as SpeechSynthesis,
    SpeechSynthesisUtterance: Utterance as unknown as typeof SpeechSynthesisUtterance,
  } satisfies SpeechHost

  return {
    host,
    /** `cancel`, `speak`, `addEventListener:<type>` in order. */
    calls,
    spoken,
    /** How many times the voices were asked for. */
    get voicesAsked() {
      return voicesAsked
    },
  }
}
