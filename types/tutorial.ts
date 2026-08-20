// Every tutorial lesson takes the same props: the theme, a callback to report that its
// task is done, and a callback to close the tutorial outright. Moving forward is not a
// lesson's business — the top bar owns that (see
// components/overlays/tutorial/tutorial-footer.tsx) — so onDismiss is optional and only
// the opening screen uses it, to offer skipping straight to the game the moment its mock
// target actually resolves.
export type LessonProps = {
  isDark: boolean
  onComplete: () => void
  onDismiss?: () => void
}
