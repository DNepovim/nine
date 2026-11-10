import type { PushReach } from '@/lib/push-reach'

// The player's answer to the push ask. 'unknown' is the state nothing migrates out of: a
// device that has never been asked has no key on disk, which parses the same as one that is
// mid-hydration. Same shape as ReplayConsent in hooks/use-replay-consent.ts.
export type PushConsent = 'unknown' | 'granted' | 'denied'

export const parsePushConsent = (raw: string | null): PushConsent =>
  raw === 'granted' || raw === 'denied' ? raw : 'unknown'

// Whether the push card is due. One rule for a first launch and for a profile older than
// the feature — both are "the feature is held and the question is still open" — so there
// is no age check anywhere.
//
// Behind the replay ask: the two are one consent in two steps, so a fresh install answers
// session recording first and is then asked about this, and an existing player (replay
// long since answered) is asked this alone. Replay's own `unknown` also covers the
// moment before its key has been read, so the step never flashes ahead of it.
export function pushStepDue({
  held,
  reach,
  replay,
  push,
  dismissed,
}: {
  held: boolean
  reach: PushReach
  replay: 'unknown' | 'granted' | 'denied'
  push: PushConsent
  dismissed: boolean
}): boolean {
  if (!held || reach === 'unsupported') return false
  return replay !== 'unknown' && push === 'unknown' && !dismissed
}
