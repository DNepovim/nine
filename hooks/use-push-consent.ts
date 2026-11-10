import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

import { PUSH_CONSENT_KEY } from '@/constants/storage'
import { useLocale } from '@/hooks/use-locale'
import {
  disablePush,
  enablePush,
  pushHelp as readPushHelp,
  pushReach as readPushReach,
  refreshPush,
  watchPushReach,
} from '@/lib/push'
import { parsePushConsent, pushStepDue, type PushConsent } from '@/lib/push-consent'
import type { PushHelp, PushReach } from '@/lib/push-reach'
import type { PushRow } from '@/types/push'

// Whether this player has been asked about push, what they said, and what the device can
// do about it. The second step of the first-launch consent, behind the replay ask — see
// `pushStepDue` for the one rule that covers a fresh install and a profile older than the
// feature — and the NOTIFICATIONS row in OPTIONS, which calls the same pair of
// switches. One hook, so the card and the row cannot disagree about what is on file.
export function usePushConsent({
  held,
  replay,
  userId,
}: {
  // The `push` feature, from useFlag. Nothing below runs without it.
  held: boolean
  // The replay ask, which this one waits behind.
  replay: 'unknown' | 'granted' | 'denied'
  userId: string | null
}): {
  consent: PushConsent
  reach: PushReach
  // Whether the card should be up: due, and read off disk already, so a stored answer
  // never flashes the question first.
  visible: boolean
  // The card's ENABLE. Resolves once the browser has answered, so the caller can close.
  allow: () => void
  decline: () => void
  // The card's close dot, and the 'install' card's OK. Session-only, like the replay card:
  // not an answer, so it is back next launch.
  dismiss: () => void
  // OPTIONS: on subscribes (prompting if it has to), off drops the address and records a no.
  setOn: (on: boolean) => void
  // The OPTIONS row and its switch: null where there is no row to show.
  row: PushRow | null
  toggle: () => void
  // What to tell a blocked player: where, on this device, notifications are switched back on.
  help: PushHelp
} {
  const { locale } = useLocale()
  const [consent, setConsent] = useState<PushConsent>('unknown')
  const [loaded, setLoaded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  // Read after mount, never at render: the web export renders this in Node, which has no
  // `navigator` to ask.
  const [reach, setReach] = useState<PushReach>('unsupported')
  const [help, setHelp] = useState<PushHelp>('browser')

  useEffect(() => {
    AsyncStorage.getItem(PUSH_CONSENT_KEY)
      .then((raw) => {
        setConsent(parsePushConsent(raw))
      })
      .catch(() => {
        // Stays 'unknown'; the card asks again next launch.
      })
      .finally(() => {
        setReach(readPushReach())
        setHelp(readPushHelp())
        setLoaded(true)
      })
  }, [])

  // The browser or the phone can change the answer while the app is open — the player turns
  // notifications off in settings, or back on after being sent there. The row follows.
  useEffect(() => watchPushReach(setReach), [])

  // A device that said yes saves its address again for whoever is on it now: a restore
  // moves a profile onto a phone, and the server moves the address with the save.
  useEffect(() => {
    if (!held || consent !== 'granted' || userId === null) return
    void refreshPush(locale)
  }, [held, consent, userId, locale, reach])

  const answer = useCallback((next: PushConsent) => {
    setConsent(next)
    AsyncStorage.setItem(PUSH_CONSENT_KEY, next).catch(() => {})
  }, [])

  const subscribe = useCallback(() => {
    void enablePush(locale).then((result) => {
      // 'failed' leaves the question open — a flaky network is not a no — but out of the
      // way for the session.
      if (result === 'failed') setDismissed(true)
      else answer(result === 'subscribed' ? 'granted' : 'denied')
      setReach(readPushReach())
    })
  }, [locale, answer])

  const unsubscribe = useCallback(() => {
    answer('denied')
    void disablePush()
  }, [answer])

  const setOn = useCallback(
    (on: boolean) => {
      if (on) subscribe()
      else unsubscribe()
    },
    [subscribe, unsubscribe],
  )

  return {
    consent,
    reach,
    visible: loaded && pushStepDue({ held, reach, replay, push: consent, dismissed }),
    allow: subscribe,
    decline: unsubscribe,
    dismiss: useCallback(() => {
      setDismissed(true)
    }, []),
    setOn,
    help,
    row:
      held && reach !== 'unsupported'
        ? { on: consent === 'granted' && reach === 'ready', reach }
        : null,
    toggle: useCallback(() => {
      setOn(consent !== 'granted')
    }, [setOn, consent]),
  }
}
