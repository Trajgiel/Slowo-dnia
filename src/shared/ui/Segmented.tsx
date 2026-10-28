// Segmented switch (materials/project/APP_SPEC.md → "6.2. Опрос"): a group of buttons, the chosen one
// marked by `aria-pressed`. Used by the quiz mode and direction.
import './Segmented.css'

export interface SegmentedOption<T extends string> {
  readonly value: T
  readonly label: string
}

export interface SegmentedProps<T extends string> {
  /** Accessible name of the group. */
  readonly label: string
  readonly options: readonly SegmentedOption<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
  /** Hidden in place (keeps its size) and out of reach, also from the keyboard and screen readers. */
  readonly hidden?: boolean
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  hidden = false,
}: SegmentedProps<T>) {
  return (
    <div
      className={hidden ? 'seg inv' : 'seg'}
      role="group"
      aria-label={label}
      inert={hidden || undefined}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => {
            onChange(option.value)
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
