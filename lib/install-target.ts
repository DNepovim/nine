import type { InstallEnv, InstallTarget } from '@/types/install'

const IOS_DEVICE = /iPhone|iPod|iPad/

// Webviews embedded in other apps. None of them can add to the home screen on
// either platform — there is no menu holding the option — so the only useful
// thing to say is which browser to reopen the page in.
const IN_APP_WEBVIEW =
  /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Twitter|Snapchat|Pinterest|MicroMessenger|TikTok/

// Chrome and Firefox on Android both keep ⋮ beside the address bar. Chrome's forks
// keep the Chrome token but move their menu, so they are ruled out by name.
const ANDROID_DOTS_MENU = /Firefox\/|Chrome\//
const ANDROID_CHROME_FORK =
  /SamsungBrowser|EdgA|OPR|YaBrowser|UCBrowser|MiuiBrowser|HuaweiBrowser|DuckDuckGo/

// Anything with a home screen: iOS is caught before this is asked, so this only has
// to recognise the rest. Android tablets drop 'Mobile' but keep 'Android'.
const MOBILE = /Android|Mobi/

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

  // A desktop has no home screen to add the game to. The window is the signal
  // rather than the user agent, because the user agent cannot be trusted to say:
  // iPadOS reports itself as a Mac on purpose, and the touch-point heuristic that
  // sees through that also catches a Mac with a touchscreen plugged into it, which
  // is how a desktop ends up being offered iPad instructions. A window this size is
  // one the app has already decided to draw a phone frame inside; offering to
  // install that as a phone app on top of it is noise.
  if (env.wideViewport) return 'none'

  // A real install event beats everything else wherever we get one. `uaMobile`
  // keeps it to phones: User-Agent Client Hints exist on exactly the Chromium
  // browsers that fire the event, so desktop answers `false` and we never have
  // to sniff a desktop UA string.
  if (env.hasPrompt && env.uaMobile === true) return 'prompt'

  // Checked before the plain iOS and Android cases, because an in-app webview
  // matches both and the menu steps would send the player looking for a menu that
  // isn't there. Positive identification only: a Chrome tab whose install event
  // simply hasn't fired yet must never be told to use Chrome.
  if (IN_APP_WEBVIEW.test(env.userAgent)) {
    if (isIos(env)) return 'open-in-safari'
    return env.userAgent.includes('Android') ? 'open-in-chrome' : 'none'
  }

  if (isIos(env)) return iosBrowser(env.userAgent)

  // Every other phone browser can add to the home screen from its own menu, so it
  // gets steps the way iOS does. A Chrome tab whose install event hasn't fired yet
  // lands here too — the event re-reads the target and upgrades the card to the
  // real button, and if it never comes (Chrome holds it back for an app already
  // installed), the menu is still the way.
  if (env.uaMobile === true || MOBILE.test(env.userAgent)) {
    const dots =
      env.userAgent.includes('Android') &&
      ANDROID_DOTS_MENU.test(env.userAgent) &&
      !ANDROID_CHROME_FORK.test(env.userAgent)
    return dots ? 'android-menu' : 'mobile-other'
  }

  return 'none'
}
