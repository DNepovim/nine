import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'

import { REPLAY_CONSENT_KEY } from '@/constants/storage'
import { setReplayConsent } from '@/lib/analytics'

// Whether the player has been asked about session recording, and what they said.
// 'unknown' is the state nothing has to migrate out of: a device that has never seen the
// banner has no key on disk, which parses the same as a device that is mid-hydration —
// both leave recording off, since that is PostHog's own default until this says
// otherwise.
export type ReplayConsent = 'unknown' | 'granted' | 'denied'

const parse = (raw: string | null): ReplayConsent =>
  raw === 'granted' || raw === 'denied' ? raw : 'unknown'

// Reads the stored answer once, applies it to the SDK, and hands back the two ways to
// change it — the banner calls `allow`/`decline` on a first ask, and the advanced
// options screen calls the same pair to let a player revisit either answer later. One
// hook rather than two, so the banner and the settings toggle can never disagree about
// what is currently on file.
export function useReplayConsent(): {
  // The persisted truth, for a reader like the options screen that wants an honest
  // answer rather than "showing right now or not".
  consent: ReplayConsent
  // Whether the banner should be up: unanswered, and not waved off this session. Closing
  // the card is not an answer — see `dismiss` — so this can go false and `consent` stay
  // 'unknown' at the same time.
  visible: boolean
  allow: () => void
  decline: () => void
  // The card's own close button. Session-only, the same rule the install prompt beside
  // it keeps: a player who has not said yes has not said no either, and the banner is
  // back on the next launch to ask again rather than nagging this one.
  dismiss: () => void
} {
  const [consent, setConsent] = useState<ReplayConsent>('unknown')
  const [dismissed, setDismissed] = useState(false)
  // Applying the stored answer to the SDK is this hook's whole job, and it has to run
  // exactly once per actual answer — not on the render that merely hydrates one off
  // disk, which already reached the SDK through `initAnalytics`'s own closed default,
  // and not twice for one tap.
  const appliedRef = useRef<ReplayConsent | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(REPLAY_CONSENT_KEY)
      .then((raw) => {
        setConsent(parse(raw))
      })
      .catch(() => {
        // Read failed: stays 'unknown', which is the safe answer and the one the banner
        // shows a retry for.
      })
  }, [])

  useEffect(() => {
    if (consent === 'unknown' || appliedRef.current === consent) return
    appliedRef.current = consent
    setReplayConsent(consent === 'granted')
  }, [consent])

  const answer = useCallback((granted: boolean) => {
    const next: ReplayConsent = granted ? 'granted' : 'denied'
    setConsent(next)
    AsyncStorage.setItem(REPLAY_CONSENT_KEY, next).catch(() => {})
  }, [])

  return {
    consent,
    visible: consent === 'unknown' && !dismissed,
    allow: useCallback(() => {
      answer(true)
    }, [answer]),
    decline: useCallback(() => {
      answer(false)
    }, [answer]),
    dismiss: useCallback(() => {
      setDismissed(true)
    }, []),
  }
}
