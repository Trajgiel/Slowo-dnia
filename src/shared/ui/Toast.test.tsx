import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toast, TOAST_MS } from './Toast'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const isOn = () => screen.getByRole('status').classList.contains('toast--on')

describe('Toast', () => {
  it('hidden until the first toast', () => {
    render(<Toast text="" seq={0} />)
    expect(isOn()).toBe(false)
  })

  it('shows for 3.5 s; the text stays after it hides', () => {
    const { rerender } = render(<Toast text="" seq={0} />)
    rerender(<Toast text="a" seq={1} />)
    expect(isOn()).toBe(true)
    act(() => {
      vi.advanceTimersByTime(TOAST_MS - 1)
    })
    expect(isOn()).toBe(true)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(isOn()).toBe(false)
    expect(screen.getByRole('status')).toHaveTextContent('a')
    expect(TOAST_MS).toBe(3500)
  })

  it('the same text again is shown again, and the timer starts over', () => {
    const { rerender } = render(<Toast text="a" seq={1} />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    rerender(<Toast text="a" seq={2} />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(isOn()).toBe(true)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(isOn()).toBe(false)
  })
})
