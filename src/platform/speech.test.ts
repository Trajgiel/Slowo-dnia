// Speech adapter → Web Speech API on a fake `speechSynthesis` (analyst/features/react-port/us-2-word.md →
// "Озвучка"; prototype `speak`).
import { describe, expect, it, vi } from 'vitest'
import { fakeSpeech } from '../test/fakeSpeech'
import { primeVoices, speak, SPEECH_LANG, SPEECH_RATE, type SpeechHost } from './speech'

describe('speak', () => {
  it('stops the current speech, then speaks the prepared text in pl-PL at 0.8 with the Polish voice', () => {
    const fake = fakeSpeech([
      { lang: 'ru-RU', name: 'Milena' },
      { lang: 'pl-PL', name: 'Zosia' },
      { lang: 'pl_PL', name: 'Second' },
    ])
    expect(speak('Dzień dobry / Cześć…', fake.host)).toBe('spoken')
    expect(fake.calls).toEqual(['cancel', 'speak'])
    const [u] = fake.spoken
    expect(u).toMatchObject({ text: 'Dzień dobry, Cześć', lang: SPEECH_LANG, rate: SPEECH_RATE })
    expect(u?.voice?.name).toBe('Zosia')
    expect([SPEECH_LANG, SPEECH_RATE]).toEqual(['pl-PL', 0.8])
  })

  it('takes a voice whose language starts with "pl" in any case', () => {
    const fake = fakeSpeech([{ lang: 'PL', name: 'Upper' }])
    expect(speak('tak', fake.host)).toBe('spoken')
    expect(fake.spoken[0]?.voice?.name).toBe('Upper')
  })

  it('no Polish voice → still speaks in pl-PL without a voice, result noVoice', () => {
    const fake = fakeSpeech([{ lang: 'ru-RU', name: 'Milena' }])
    expect(speak('tak', fake.host)).toBe('noVoice')
    expect(fake.spoken).toHaveLength(1)
    expect(fake.spoken[0]).toMatchObject({ lang: 'pl-PL', voice: null })
  })

  it('no speech API → unsupported', () => {
    expect(speak('tak', {})).toBe('unsupported')
    expect(speak('tak', { speechSynthesis: fakeSpeech([]).host.speechSynthesis })).toBe(
      'unsupported',
    )
  })

  it('the API throws → unsupported, nothing escapes', () => {
    const fake = fakeSpeech([{ lang: 'pl-PL', name: 'Zosia' }], { throwOnSpeak: true })
    expect(speak('tak', fake.host)).toBe('unsupported')
  })
})

describe('primeVoices', () => {
  it('listens to voiceschanged and asks for the voices', () => {
    const fake = fakeSpeech([])
    primeVoices(fake.host)
    expect(fake.calls).toEqual(['addEventListener:voiceschanged'])
    expect(fake.voicesAsked).toBe(1)
  })

  it('does nothing without the API and never throws', () => {
    expect(() => {
      primeVoices({})
    }).not.toThrow()
    const throwing: SpeechHost = {
      get speechSynthesis(): SpeechSynthesis {
        throw new Error('blocked')
      },
    }
    expect(() => {
      primeVoices(throwing)
    }).not.toThrow()
  })

  it('uses window by default (jsdom has no speech)', () => {
    const spy = vi.spyOn(console, 'error')
    expect(() => {
      primeVoices()
    }).not.toThrow()
    expect(speak('tak')).toBe('unsupported')
    expect(spy).not.toHaveBeenCalled()
  })
})
