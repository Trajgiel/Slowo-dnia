// Speech synthesis over the Web Speech API (architecture/react-port/modules.md → "Платформа (platform)";
// analyst/features/react-port/us-2-word.md → "Озвучка"; prototype `speak`). The language is set on the
// utterance, so the page language `ru` does not change the voice.
import { speechText } from '../domain'

/** What happened on "Послушать": spoken by a Polish voice, spoken without one, or no speech API. */
export type SpeakResult = 'spoken' | 'noVoice' | 'unsupported'

export const SPEECH_LANG = 'pl-PL'
export const SPEECH_RATE = 0.8

/** A Polish voice: the first one whose language starts with `pl` (as the prototype). */
const POLISH_VOICE = /^pl/i

/** The part of `window` speech needs; both members are missing in browsers without the API. */
export interface SpeechHost {
  readonly speechSynthesis?: SpeechSynthesis
  readonly SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance
}

const noop = (): void => undefined

/**
 * Speaks `text` in Polish: stops the current speech, `lang = "pl-PL"`, rate 0.8, the first Polish voice
 * if there is one. Without a Polish voice the speech still starts (the browser picks a voice by `lang`)
 * and the result is `noVoice`. Never throws: any failure of the API is `unsupported`.
 */
export function speak(text: string, host: SpeechHost = window): SpeakResult {
  try {
    const synth = host.speechSynthesis
    const Utterance = host.SpeechSynthesisUtterance
    if (!synth || !Utterance) return 'unsupported'
    synth.cancel()
    const utterance = new Utterance(speechText(text))
    utterance.lang = SPEECH_LANG
    utterance.rate = SPEECH_RATE
    const voice = synth.getVoices().find((v) => POLISH_VOICE.test(v.lang))
    if (voice) utterance.voice = voice
    synth.speak(utterance)
    return voice ? 'spoken' : 'noVoice'
  } catch {
    return 'unsupported'
  }
}

/**
 * Asks the browser for its voices at start-up. Some browsers fill the list only later and announce it
 * with `voiceschanged`; asking early and listening makes the list ready by the first press (prototype).
 */
export function primeVoices(host: SpeechHost = window): void {
  try {
    const synth = host.speechSynthesis
    if (!synth) return
    synth.addEventListener('voiceschanged', noop)
    synth.getVoices()
  } catch {
    // No speech in this browser: "Послушать" reports it when pressed.
  }
}
