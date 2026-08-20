// Every tutorial lesson takes the same two props: the theme, and a callback to report
// that its task is done. Moving forward is not a lesson's business — the top bar owns
// that (see components/overlays/tutorial/tutorial-footer.tsx), so no button is threaded
// down into a screen's layout to find room for.
export type LessonProps = {
  isDark: boolean
  onComplete: () => void
}
