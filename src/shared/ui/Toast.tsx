// The one toast of the app (analyst/product.md → "Общие требования к экранам": 3.5 s, above the tabs,
// fades in, read by screen readers). The text stays in place after it hides, as in the prototype.
import { useEffect, useState } from 'react'
import './Toast.css'

/** How long a toast is shown. */
export const TOAST_MS = 3500

export interface ToastProps {
  readonly text: string
  /** A new number shows the toast again, even with the same text; `0` — nothing shown yet. */
  readonly seq: number
}

export function Toast({ text, seq }: ToastProps) {
  const [hiddenSeq, setHiddenSeq] = useState(0)

  useEffect(() => {
    if (seq === 0) return
    const timer = setTimeout(() => {
      setHiddenSeq(seq)
    }, TOAST_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [seq])

  const shown = seq !== 0 && seq !== hiddenSeq
  return (
    <div className={shown ? 'toast toast--on' : 'toast'} role="status" aria-live="polite">
      {text}
    </div>
  )
}
