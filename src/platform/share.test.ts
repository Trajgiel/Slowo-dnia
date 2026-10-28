import { describe, expect, it, vi } from 'vitest'
import { canShare, copyText, shareText, type ShareHost } from './share'

const denied = (): Promise<never> => Promise.reject(new DOMException('no', 'NotAllowedError'))

describe('copyText', () => {
  it('writes the text to the clipboard → true', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    expect(await copyText('SD1.k.x', { clipboard: { writeText } })).toBe(true)
    expect(writeText).toHaveBeenCalledWith('SD1.k.x')
  })

  it('no clipboard (plain http, old browser) → false', async () => {
    expect(await copyText('SD1.k.x', {})).toBe(false)
    expect(await copyText('SD1.k.x', undefined)).toBe(false)
  })

  it('the browser refuses → false, no exception', async () => {
    expect(await copyText('SD1.k.x', { clipboard: { writeText: denied } })).toBe(false)
  })
})

describe('canShare / shareText', () => {
  it('no navigator.share → cannot share, nothing opens', async () => {
    expect(canShare({})).toBe(false)
    expect(await shareText({ title: 't', text: 'c' }, {})).toBe(false)
  })

  it('opens the system share with title and text → true', async () => {
    const share = vi.fn<NonNullable<ShareHost['share']>>(() => Promise.resolve())
    expect(canShare({ share })).toBe(true)
    expect(await shareText({ title: 'Title', text: 'SD1.a.x' }, { share })).toBe(true)
    expect(share).toHaveBeenCalledWith({ title: 'Title', text: 'SD1.a.x' })
  })

  it('cancelled (AbortError) or refused → false, no exception', async () => {
    const abort = (): Promise<never> => Promise.reject(new DOMException('c', 'AbortError'))
    expect(await shareText({ title: 't', text: 'c' }, { share: abort })).toBe(false)
    expect(await shareText({ title: 't', text: 'c' }, { share: denied })).toBe(false)
  })
})
