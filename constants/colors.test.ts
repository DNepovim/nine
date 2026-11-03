import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { SCHEMES } from '@/constants/colors'

// The tokens the app's one `@theme` declares, read from the file itself so a token added
// there is a token every scheme has to answer for.
const THEME_TOKENS = [
  ...readFileSync('global.css', 'utf8').matchAll(/^ {2}(--color-[a-z-]+):/gm),
].map((match) => match[1])

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
})
