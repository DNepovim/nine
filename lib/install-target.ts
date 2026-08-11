import type { InstallEnv, InstallTarget } from '@/types/install'

// iOS browsers that aren't Safari. They can add to the home screen too, but
// their toolbars sit elsewhere, so Safari's steps would point at nothing.
const NON_SAFARI_IOS = /CriOS|FxiOS|EdgiOS|OPiOS/

const IOS_DEVICE = /iPhone|iPod|iPad/

// iPadOS Safari reports itself as a Mac and drops 'iPad' from the UA entirely.
// A Mac with a touchscreen is the giveaway, since no Mac has one.
const isIpadPretendingToBeAMac = (userAgent: string, maxTouchPoints: number): boolean =>
  userAgent.includes('Macintosh') && maxTouchPoints > 1

const isIosSafari = ({ userAgent, maxTouchPoints }: InstallEnv): boolean => {
  if (NON_SAFARI_IOS.test(userAgent)) return false
  return IOS_DEVICE.test(userAgent) || isIpadPretendingToBeAMac(userAgent, maxTouchPoints)
}

export function resolveInstallTarget(env: InstallEnv): InstallTarget {
  // Nothing left to ask for — and this is also what keeps the popup out of the
  // installed app itself.
  if (env.standalone) return 'none'

  // A real install event beats instructions wherever we get one. `uaMobile`
  // keeps it to phones: User-Agent Client Hints exist on exactly the Chromium
  // browsers that fire the event, so desktop answers `false` and we never have
  // to sniff a desktop UA string.
  if (env.hasPrompt && env.uaMobile === true) return 'prompt'

  if (isIosSafari(env)) return 'instructions'

  return 'none'
}
