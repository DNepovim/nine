import { isIos } from '@/lib/install-target'

// What this device can do about a push right now, from a snapshot of the browser. Pure so
// the four answers are tested without a browser: lib/push.web.ts reads the snapshot and
// everything else asks this.
//
//   ready        the player can be asked, and a yes will subscribe
//   install      iOS outside an installed app — Safari only grants push to a web app on
//                the Home Screen, so the ask would fail; say so instead
//   blocked      the browser has refused already; no code can ask again, only settings
//   unsupported  no Push API at all (or a native build, which has no adapter yet)
export type PushReach = 'ready' | 'install' | 'blocked' | 'unsupported'

export type PushEnv = {
  // Whether this build carries the VAPID key. Without it nothing can be subscribed anywhere,
  // so it is asked before iOS's "install first": telling a player to install an app that
  // still could not push would be a promise nobody can keep.
  configured: boolean
  // Raw, so the iOS question is asked the way the install prompt asks it — iPadOS poses as a
  // Mac, and `isIos` is what sees through that.
  userAgent: string
  maxTouchPoints: number
  standalone: boolean
  hasPushApi: boolean
  permission: 'default' | 'granted' | 'denied'
}

export function pushReach({
  configured,
  userAgent,
  maxTouchPoints,
  standalone,
  hasPushApi,
  permission,
}: PushEnv): PushReach {
  if (!configured) return 'unsupported'
  // Before the API check: iOS withholds PushManager from a tab altogether, so a missing
  // API there means "install first", not "never".
  if (isIos({ userAgent, maxTouchPoints }) && !standalone) return 'install'
  if (!hasPushApi) return 'unsupported'
  if (permission === 'denied') return 'blocked'
  return 'ready'
}
