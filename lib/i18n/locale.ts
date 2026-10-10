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

// The locale the app is actually in, which is not always the one the player picked:
// every language but English sits behind the `czech` feature, so a player who does not
// reach it reads English however the stored key is set.
//
// The pick is the argument rather than something this clears, and that is the whole
// point of writing the rule here instead of at the storage read: a feature taken away
// for a week must not erase a choice, and granting it again has to land the player back
// in the language they were in.
export const activeLocale = (pick: Locale, czech: boolean): Locale =>
  czech ? pick : DEFAULT_LOCALE
