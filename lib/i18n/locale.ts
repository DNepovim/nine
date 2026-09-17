// The languages Nine speaks. English first: it is the source locale, and the fallback
// for every device asking for something else.
export const LOCALES = ['en', 'cs'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

const isLocale = (value: string): value is Locale => LOCALES.includes(value as Locale)

// The locale a device's own preferences ask for.
//
// `tags` arrives in the device's preference order, so the first one we speak wins rather
// than the first one listed — a player whose first choice we cannot serve still gets
// their second. Region is dropped: a Czech speaker on a device set to Slovakia is still
// reading Czech.
//
// Tags are passed in rather than read from expo-localization here, so this stays pure
// and a test can hand it any device.
export function resolveSystemLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const language = tag.trim().toLowerCase().split('-')[0] ?? ''
    if (isLocale(language)) return language
  }
  return DEFAULT_LOCALE
}

// A stored locale is only worth honouring if this build still speaks it — a key written
// by a later build, or by hand, must not leave the app with no messages at all.
export const storedLocale = (raw: string | null): Locale | null =>
  raw !== null && isLocale(raw) ? raw : null
