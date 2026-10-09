// Whether this launch is a player coming straight back to an app they were just looking
// at — a web-only idea. The real implementation is in recent-return.web.ts; this variant
// exists so the native bundle never reaches for localStorage.
//
// Native has no use for it either way. An app in the background on iOS or Android is a
// suspended process that resumes where it was, with no launch to skip a splash on; the
// thing this answers only happens to a home-screen web app, whose process the OS ends
// outright and reloads from nothing when the player comes back.
export const cameStraightBack = (): boolean => false
export const noteLeaving = (): void => {}
