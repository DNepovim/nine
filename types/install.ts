// What the current browser can do about putting the app on the home screen.
//
// 'prompt'          — the browser handed us an install event we can fire
// 'ios-safari'      — add it by hand; Share sits in the toolbar
// 'ios-chrome'      — add it by hand; Share sits next to the address bar
// 'ios-other'       — add it by hand; some other iOS browser, so name no location
// 'open-in-safari'  — an iOS in-app webview, which cannot add to the home screen at all
// 'open-in-chrome'  — the same on Android
// 'none'            — already installed, or a browser we can't advise accurately
//
// The three iOS targets differ only in where that browser keeps Share. Naming
// one location for all of them is what makes an instruction unfollowable.
export type InstallTarget =
  | 'prompt'
  | 'ios-safari'
  | 'ios-chrome'
  | 'ios-other'
  | 'open-in-safari'
  | 'open-in-chrome'
  | 'none'

// The targets that actually render something. The overlay takes this rather than
// InstallTarget, so an invisible popup is impossible to construct.
export type InstallableTarget = Exclude<InstallTarget, 'none'>

// Everything `resolveInstallTarget` needs to decide, gathered by the caller so
// the decision itself stays pure and testable without a DOM.
export type InstallEnv = {
  standalone: boolean
  hasPrompt: boolean
  // Whether the window is desktop-sized — see `lib/desktop.ts`.
  wideViewport: boolean
  // `undefined` on browsers without User-Agent Client Hints — every WebKit one.
  uaMobile: boolean | undefined
  userAgent: string
  maxTouchPoints: number
}
