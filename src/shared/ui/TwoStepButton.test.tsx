import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TWO_STEP_MS, TwoStepButton } from './TwoStepButton'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const LABEL = 'Do it'
const ARMED = 'Sure?'

function setup() {
  const onConfirm = vi.fn()
  const view = render(
    <TwoStepButton label={LABEL} armedLabel={ARMED} onConfirm={onConfirm} className="ghost" />,
  )
  return { ...view, onConfirm, button: () => screen.getByRole('button') }
}

describe('TwoStepButton', () => {
  it('first press only warns; the second within 5 s runs the action and the label returns', () => {
    const { button, onConfirm } = setup()
    fireEvent.click(button())
    expect(button()).toHaveTextContent('Sure?')
    expect(button()).toHaveClass('ghost', 'armed')
    expect(onConfirm).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(TWO_STEP_MS - 1)
    })
    fireEvent.click(button())
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(button()).toHaveTextContent('Do it')
    expect(button()).not.toHaveClass('armed')
  })

  it('after 5 s the warning is gone and the next press only warns again', () => {
    const { button, onConfirm } = setup()
    fireEvent.click(button())
    act(() => {
      vi.advanceTimersByTime(TWO_STEP_MS)
    })
    expect(button()).toHaveTextContent('Do it')
    fireEvent.click(button())
    expect(onConfirm).not.toHaveBeenCalled()
    expect(button()).toHaveTextContent('Sure?')
  })

  it('unmounted while warning → the timer is cleared', () => {
    const { button, unmount } = setup()
    fireEvent.click(button())
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
