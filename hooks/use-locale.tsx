import { i18n } from '@lingui/core'
import { I18nProvider, type TransRenderProps } from '@lingui/react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Text } from 'react-native'

import { LOCALE_KEY } from '@/constants/storage'
import { DEFAULT_LOCALE, storedLocale, type Locale } from '@/lib/i18n/locale'
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
}>({ locale: DEFAULT_LOCALE, setLocale: () => undefined })

export const useLocale = () => useContext(LocaleContext)

// React Native has no host element that accepts a bare string, so a <Trans> rendered
// outside a <Text> would crash rather than render. Every one in this app sits inside a
// <Text> already; this is the net under the one that someday will not.
const TransText = (props: TransRenderProps) => <Text>{props.children}</Text>

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
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  const apply = useCallback((next: Locale) => {
    i18n.activate(next)
    setLocaleState(next)
  }, [])

  useEffect(() => {
    void (async () => {
      const chosen = await AsyncStorage.getItem(LOCALE_KEY)
        .then(storedLocale)
        .catch(() => null)
      if (chosen !== null) apply(chosen)
    })()
  }, [apply])

  const setLocale = useCallback(
    (next: Locale) => {
      apply(next)
      AsyncStorage.setItem(LOCALE_KEY, next).catch(() => {})
    },
    [apply],
  )

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <I18nProvider i18n={i18n} defaultComponent={TransText}>
        {children}
      </I18nProvider>
    </LocaleContext.Provider>
  )
}
