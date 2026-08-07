import type { ReactNode } from 'react'

// Every tutorial lesson takes the same three props: the theme, a callback to
// report that its task is done, and the Next button to place wherever it reads
// naturally on that screen (null when the screen has a task still to fulfil).
export type LessonProps = {
  isDark: boolean
  onComplete: () => void
  nextButton: ReactNode
}
