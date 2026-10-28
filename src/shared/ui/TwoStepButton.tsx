// Button of a dangerous action pressed twice (analyst/product.md → "Общие требования к экранам";
// prototype `twoStep`): the first press only changes the label to the warning for 5 s, the second within
// that time runs the action. The timer lives here, not in the store: when the button unmounts (another
// tab), the warning is gone and nothing runs (architecture/react-port/modules.md → "Двойное нажатие").
import { useEffect, useRef, useState } from 'react'

/** How long the warning waits for the second press. */
export const TWO_STEP_MS = 5000

export interface TwoStepButtonProps {
  readonly label: string
  /** Label after the first press. */
  readonly armedLabel: string
  readonly onConfirm: () => void
  readonly className?: string
}

export function TwoStepButton({ label, armedLabel, onConfirm, className }: TwoStepButtonProps) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )

  const classes = [className, armed ? 'armed' : undefined].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={classes || undefined}
      onClick={() => {
        clearTimeout(timer.current)
        if (!armed) {
          setArmed(true)
          timer.current = setTimeout(() => {
            setArmed(false)
          }, TWO_STEP_MS)
          return
        }
        setArmed(false)
        onConfirm()
      }}
    >
      {armed ? armedLabel : label}
    </button>
  )
}
