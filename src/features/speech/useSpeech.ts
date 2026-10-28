// "🔊 Послушать" on "Слово" and in the quiz: speaks through the platform and keeps what to tell the user
// (analyst/features/react-port/us-2-word.md → "Озвучка").
import { useCallback, useState } from 'react'
import { speak, type SpeakResult } from '../../platform'

export interface Speech {
  /** Result of the last press; `null` — no message. */
  readonly result: SpeakResult | null
  /** Speaks the Polish text and remembers the result for the message. */
  readonly say: (text: string) => void
  /** Hides the message (another word was opened). */
  readonly clear: () => void
}

export function useSpeech(): Speech {
  const [result, setResult] = useState<SpeakResult | null>(null)
  const say = useCallback((text: string) => {
    setResult(speak(text))
  }, [])
  const clear = useCallback(() => {
    setResult(null)
  }, [])
  return { result, say, clear }
}
