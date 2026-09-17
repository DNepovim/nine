import { describe, expect, it } from 'vitest'

import { LOCALES, resolveSystemLocale, storedLocale, type Locale } from './locale'

describe('resolveSystemLocale', () => {
  it('takes Czech when the device asks for it', () => {
    expect(resolveSystemLocale(['cs-CZ'])).toBe('cs')
  })

  it('reads the language, not the region', () => {
    // A Czech speaker on a device set to Slovakia still gets Czech.
    expect(resolveSystemLocale(['cs-SK'])).toBe('cs')
    expect(resolveSystemLocale(['cs'])).toBe('cs')
  })

  it('falls back to English for a language we do not speak', () => {
    expect(resolveSystemLocale(['de-DE'])).toBe('en')
    expect(resolveSystemLocale(['sk-SK'])).toBe('en')
  })

  it('takes the first tag we speak rather than the first tag', () => {
    // Device preference order: a player whose first choice we cannot serve still
    // gets their second if we speak it.
    expect(resolveSystemLocale(['sk-SK', 'cs-CZ', 'en-GB'])).toBe('cs')
  })

  it('falls back to English when the device says nothing', () => {
    expect(resolveSystemLocale([])).toBe('en')
  })

  it('is not fooled by case or stray whitespace', () => {
    expect(resolveSystemLocale([' CS-cz '])).toBe('cs')
  })

  it('lists every locale the app speaks', () => {
    const all: Locale[] = [...LOCALES]
    expect(all).toStrictEqual(['en', 'cs'])
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
