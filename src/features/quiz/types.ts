/** Wraps a press of the quiz so that it also hides the speech message. */
export type Press = <A extends unknown[]>(action: (...args: A) => void) => (...args: A) => void

export interface QuizModeProps {
  readonly press: Press
  /** Speaks the Polish text and shows the speech message if needed. */
  readonly onSpeak: (text: string) => void
}
