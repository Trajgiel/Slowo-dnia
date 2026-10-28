import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Segmented } from './Segmented'

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
] as const
const LABEL = 'Group'

describe('Segmented', () => {
  it('a named group; the chosen button is pressed; a press reports its value', () => {
    const onChange = vi.fn()
    render(<Segmented label={LABEL} options={options} value="a" onChange={onChange} />)
    const group = screen.getByRole('group', { name: 'Group' })
    expect(group).not.toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'B' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('hidden → keeps its place (inv) and is inert', () => {
    const { container } = render(
      <Segmented label={LABEL} options={options} value="a" onChange={vi.fn()} hidden />,
    )
    const group = container.querySelector('.seg')
    expect(group).toHaveClass('inv')
    expect(group).toHaveAttribute('inert')
  })
})
