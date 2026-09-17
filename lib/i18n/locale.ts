// The languages Nine speaks. English first: it is the source locale, and the fallback
// for every device asking for something else.
export const LOCALES = ['en', 'cs'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

const isLocale = (value: string): value is Locale => LOCALES.includes(value as Locale)

// A stored locale is only worth honouring if this build still speaks it — a key written
// by a later build, or by hand, must not leave the app with no messages at all.
export const storedLocale = (raw: string | null): Locale | null =>
  raw !== null && isLocale(raw) ? raw : null
