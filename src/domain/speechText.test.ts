// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { speechText } from './speechText'

describe('speechText', () => {
  it.each([
    ['Dzień dobry', 'Dzień dobry'],
    ['Mam na imię…', 'Mam na imię'],
    ['…i …już…', 'i już'],
    ['pan / pani', 'pan, pani'],
    ['a / b / c', 'a, b, c'],
    ['a\t/\nb', 'a, b'],
    ['biało-czerwony/biała', 'biało-czerwony/biała'],
    ['a /b', 'a /b'],
  ])('%j → %j', (text, spoken) => {
    expect(speechText(text)).toBe(spoken)
  })
})
