import { i18n } from '@lingui/core'
import { I18nProvider, type TransRenderProps } from '@lingui/react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { Text } from 'react-native'

import { LOCALE_KEY } from '@/constants/storage'
import { useFlag } from '@/hooks/use-flags'
import {
  activeLocale,
  DEFAULT_LOCALE,
  storedLocale,
  type Locale,
} from '@/lib/i18n/locale'
import { messages as cs } from '@/locales/cs/messages'
import { messages as en } from '@/locales/en/messages'

// Both catalogs ship in the bundle. Two languages of short UI copy is a few kilobytes,
// and fetching one on demand would mean a frame of untranslated text on every switch.
i18n.load({ en, cs })
// Activated before anything renders: `i18n._()` throws outright when no locale is set,
// and that throw is not development-only.
i18n.activate(DEFAULT_LOCALE)

const LocaleContext = createContext<{
  locale: Locale
  setLocale: (locale: Locale) => void
  // Whether any language but English is the player's to pick, and so whether options
  // shows the row that picks one. Reported into the provider by <LocaleGate> rather
  // than asked for here — see below.
  czech: boolean
  allowCzech: (allowed: boolean) => void
}>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  czech: false,
  allowCzech: () => undefined,
})

export const useLocale = () => useContext(LocaleContext)

// React Native has no host element that accepts a bare string, so a <Trans> rendered
// outside a <Text> would crash rather than render. Every one in this app sits inside a
// <Text> already; this is the net under the one that someday will not.
//
// Exported for the crash screen, which needs a provider of its own — see the
// `ErrorBoundary` in app/_layout.tsx. Both have to pass the same renderer or a `Trans`
// would behave differently on the one screen nobody can test by playing.
export const TransText = (props: TransRenderProps) => <Text>{props.children}</Text>

// The active language, and the one control that changes it.
//
// Unlike the other persisted hooks here there is no write-on-change effect, so there is
// no gate to open: the only write follows an explicit tap in options, and a tap is the
// player's intent rather than a default that could overwrite a choice we failed to read.
//
// English until the player picks otherwise. The device's own language is deliberately
// not consulted: a Czech phone is not a request for a Czech game, the switch is two taps
// away in options, and a default that depends on the device is a default nobody can
// reproduce when something looks wrong.
//
// Two inputs, not one: the player's pick and whether they reach `czech`. `locale` is
// what the two come to — see `activeLocale` — and both move only through a callback, so
// `i18n.activate` happens in the handler that caused it rather than in an effect after
// the tree has already rendered a frame in the language being left.
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  // Refs, not state: nothing renders either one on its own, and keeping them out of the
  // render means `apply` can read both at the moment it is called rather than close over
  // whichever of them was last committed.
  const pick = useRef<Locale>(DEFAULT_LOCALE)
  const czechRef = useRef(false)
  // The one piece of the pair a screen does read — options, to decide whether to offer
  // the row at all.
  const [czech, setCzechState] = useState(false)

  const apply = useCallback(() => {
    const next = activeLocale(pick.current, czechRef.current)
    if (next === i18n.locale) return
    i18n.activate(next)
    setLocaleState(next)
  }, [])

  useEffect(() => {
    void (async () => {
      const chosen = await AsyncStorage.getItem(LOCALE_KEY)
        .then(storedLocale)
        .catch(() => null)
      if (chosen === null) return
      pick.current = chosen
      apply()
    })()
  }, [apply])

  const setLocale = useCallback(
    (next: Locale) => {
      pick.current = next
      apply()
      AsyncStorage.setItem(LOCALE_KEY, next).catch(() => {})
    },
    [apply],
  )

  // Called from inside the flags tree, which is where the answer lives. Granting the
  // feature puts the player back in their stored language; losing it puts them in
  // English without touching the key, so the next grant restores the choice.
  const allowCzech = useCallback(
    (allowed: boolean) => {
      czechRef.current = allowed
      setCzechState(allowed)
      apply()
    },
    [apply],
  )

  return (
    <LocaleContext.Provider value={{ locale, setLocale, czech, allowCzech }}>
      <I18nProvider i18n={i18n} defaultComponent={TransText}>
        {children}
      </I18nProvider>
    </LocaleContext.Provider>
  )
}

// The one wire that runs the other way. `LocaleProvider` sits at the root — above the
// splash and above the dev gallery's own chrome, because the language decides what every
// string below it says — while the feature set arrives from the server far lower down,
// inside `FlagsProvider`. So the provider cannot ask; something under the flags has to
// tell it, and this renders nothing but that answer.
//
// Mount it directly inside `FlagsProvider`. `can` answers false until auth settles, so a
// player who reaches Czech reads one English frame first and then their own language —
// the same way round, and for the same reason, as the intro painting without a tester's
// extra doors. See hooks/use-flags.tsx.
export function LocaleGate() {
  const allowed = useFlag('czech')
  const { allowCzech } = useLocale()

  useEffect(() => {
    allowCzech(allowed)
  }, [allowCzech, allowed])

  return null
}
