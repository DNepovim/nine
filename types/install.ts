// What the current browser can do about putting the app on the home screen.
//
// 'prompt'       — the browser handed us an install event we can fire
// 'instructions' — no install API, but the player can add it by hand (iOS Safari)
// 'none'         — already installed, or a browser we can't advise accurately
export type InstallTarget = 'prompt' | 'instructions' | 'none'

// The two targets that actually render something. The overlay takes this rather
// than InstallTarget, so an invisible popup is impossible to construct.
export type InstallableTarget = Exclude<InstallTarget, 'none'>

// Everything `resolveInstallTarget` needs to decide, gathered by the caller so
// the decision itself stays pure and testable without a DOM.
export type InstallEnv = {
  standalone: boolean
  hasPrompt: boolean
  // `undefined` on browsers without User-Agent Client Hints — every WebKit one.
  uaMobile: boolean | undefined
  userAgent: string
  maxTouchPoints: number
}
