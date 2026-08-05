// Every tutorial lesson takes the same two props: the theme, and a callback to
// report that its task is done (unlocking Next in the gated run).
export type LessonProps = {
  isDark: boolean
  onComplete: () => void
}
