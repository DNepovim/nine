import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { DOS_BLUE, DOS_WHITE, SCHEMES } from '@/constants/colors'

// The tokens the app's one `@theme` declares, read from the file itself so a token added
// there is a token every scheme has to answer for.
const THEME_TOKENS = [
  ...readFileSync('global.css', 'utf8').matchAll(/^ {2}(--color-[a-z-]+):/gm),
].map((match) => match[1])

// Every colour string inside a value, however deep.
const coloursIn = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : typeof value === 'object' && value !== null
      ? Object.values(value).flatMap(coloursIn)
      : []

describe('the schemes', () => {
  it('leaves day to the app’s own theme, re-binding nothing', () => {
    expect(SCHEMES.day.tokens).toEqual({})
  })

  it('has dark answer for every token the theme declares', () => {
    expect(THEME_TOKENS.length).toBeGreaterThan(0)
    const dark = Object.keys(SCHEMES.dark.tokens)
    expect(dark).toHaveLength(THEME_TOKENS.length)
    expect(new Set(dark)).toEqual(new Set(THEME_TOKENS))
  })

  it('has dos answer for every token too', () => {
    expect(new Set(Object.keys(SCHEMES.dos.tokens))).toEqual(new Set(THEME_TOKENS))
  })

  it('draws dos in its blue and white and nothing else', () => {
    // The status bar's style is a word, not a colour.
    const colours = new Set(
      [...coloursIn(SCHEMES.dos.tokens), ...coloursIn(SCHEMES.dos.inks)].filter(
        (value) => value !== SCHEMES.dos.inks.statusBar,
      ),
    )
    expect(colours).toEqual(new Set([DOS_BLUE, DOS_WHITE]))
  })
})
