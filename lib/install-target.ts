import type { InstallEnv, InstallTarget } from '@/types/install'

const IOS_DEVICE = /iPhone|iPod|iPad/

// Webviews embedded in other apps. None of them can add to the home screen on
// either platform — there is no menu holding the option — so the only useful
// thing to say is which browser to reopen the page in.
const IN_APP_WEBVIEW =
  /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Twitter|Snapchat|Pinterest|MicroMessenger|TikTok/

// iPadOS Safari reports itself as a Mac and drops 'iPad' from the UA entirely.
// A Mac with a touchscreen is the giveaway, since no Mac has one.
const isIpadPretendingToBeAMac = (userAgent: string, maxTouchPoints: number): boolean =>
  userAgent.includes('Macintosh') && maxTouchPoints > 1

// Every iOS browser, not just Safari: they all run WebKit, they all reach Add to
// Home Screen through a share menu, and excluding the others only meant a player
// browsing in Chrome was told nothing at all.
const isIos = ({ userAgent, maxTouchPoints }: InstallEnv): boolean =>
  IOS_DEVICE.test(userAgent) || isIpadPretendingToBeAMac(userAgent, maxTouchPoints)

// Which iOS browser, so the steps can name where Share actually is. Chrome puts
// it beside the address bar; Safari keeps it in the toolbar. Anything else gets
// wording that names no location rather than a wrong one.
const iosBrowser = (userAgent: string): InstallTarget => {
  if (userAgent.includes('CriOS')) return 'ios-chrome'
  if (/FxiOS|EdgiOS|OPiOS/.test(userAgent)) return 'ios-other'
  return 'ios-safari'
}

export function resolveInstallTarget(env: InstallEnv): InstallTarget {
  // Nothing left to ask for — and this is also what keeps the popup out of the
  // installed app itself.
  if (env.standalone) return 'none'

  // A real install event beats everything else wherever we get one. `uaMobile`
  // keeps it to phones: User-Agent Client Hints exist on exactly the Chromium
  // browsers that fire the event, so desktop answers `false` and we never have
  // to sniff a desktop UA string.
  if (env.hasPrompt && env.uaMobile === true) return 'prompt'

  // Checked before the plain iOS case, because an in-app webview on an iPhone
  // matches both and the share-sheet steps would send the player looking for a
  // menu that isn't there. Positive identification only: a Chrome tab whose
  // install event simply hasn't fired yet must never be told to use Chrome.
  if (IN_APP_WEBVIEW.test(env.userAgent)) {
    if (isIos(env)) return 'open-in-safari'
    return env.userAgent.includes('Android') ? 'open-in-chrome' : 'none'
  }

  if (isIos(env)) return iosBrowser(env.userAgent)

  return 'none'
}
