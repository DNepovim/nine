import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, LOCALES, storedLocale, type Locale } from './locale'

describe('the locales the app speaks', () => {
  it('lists them, English first', () => {
    const all: Locale[] = [...LOCALES]
    expect(all).toStrictEqual(['en', 'cs'])
  })

  it('starts in English rather than in whatever the device asks for', () => {
    // Deliberate: the device's language is never consulted, so a fresh install is in
    // English until the player says otherwise. See hooks/use-locale.tsx.
    expect(DEFAULT_LOCALE).toBe('en')
  })
})

describe('storedLocale', () => {
  it('honours a locale this build speaks', () => {
    expect(storedLocale('cs')).toBe('cs')
  })

  it('refuses one it does not', () => {
    // Written by a later build, or by hand. Falling back beats rendering nothing.
    expect(storedLocale('de')).toBeNull()
    expect(storedLocale('')).toBeNull()
    expect(storedLocale(null)).toBeNull()
  })
})
