import type { Locale } from '@/lib/i18n/locale'
import type { PushReach } from '@/lib/push-reach'
import type { EnableResult } from '@/types/push'

// Push, from the app's side: whether this device can be pushed to, subscribing it, and
// handing the address to the server. The real implementation is in push.web.ts; this
// variant is the native one, and says "unsupported" until `expo-notifications` is wired in
// behind the same four calls — the table already has a `platform` column for it.
export const pushReach = (): PushReach => 'unsupported'

// The one that prompts: call it from a tap, never from an effect — iOS refuses otherwise.
export const enablePush = (_locale: Locale): Promise<EnableResult> =>
  Promise.resolve('failed')

// For a device that already said yes: saves the address again for whichever profile is on
// it now, and never prompts. A restore moves a profile onto a device, and the server moves
// the address with it.
export const refreshPush = (_locale: Locale): Promise<void> => Promise.resolve()

export const disablePush = (): Promise<void> => Promise.resolve()
