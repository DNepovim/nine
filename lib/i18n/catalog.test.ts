import { i18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { beforeAll, describe, expect, it } from 'vitest'

import { LOCALES } from '@/lib/i18n/locale'
import { messages as cs } from '@/locales/cs/messages'
import { messages as en } from '@/locales/en/messages'

const CATALOGS = { en, cs }

beforeAll(() => {
  i18n.load(CATALOGS)
})

describe('the compiled catalogs', () => {
  it('speaks every language the app offers', () => {
    const byName = (a: string, b: string) => a.localeCompare(b)
    expect(Object.keys(CATALOGS).sort(byName)).toStrictEqual([...LOCALES].sort(byName))
  })

  it('has a translation for every source message', () => {
    // `lingui extract` prints a missing count, but printing is not failing. This is
    // what stops a build shipping with a key that silently falls back to English.
    // A compiled entry is the translation string, or an array of message parts for
    // anything with a placeholder in it. Both are empty in the same way.
    const untranslated = Object.keys(en).filter((id) => {
      const entry = (cs as Record<string, string | unknown[] | undefined>)[id]
      if (entry === undefined) return true
      return Array.isArray(entry) ? entry.length === 0 : entry === ''
    })
    expect(untranslated).toStrictEqual([])
  })

  it('carries nothing the source no longer says', () => {
    // A stale entry is a translation of copy that has been deleted or reworded — it
    // will never be shown again, and it hides the fact that the new wording is missing.
    expect(Object.keys(cs).filter((id) => !(id in en))).toStrictEqual([])
  })
})

describe('the macro pipeline', () => {
  // Proves the whole chain in one assertion: the macro is expanded at build time, the
  // id it generates matches the one the extractor wrote, and the compiled catalog
  // resolves it. `.test.ts` is excluded from extraction, so referencing copy here adds
  // nothing to the catalogs — it can only match what the app already says.
  const playGame = msg`PLAY GAME`

  it('resolves the source text in English', () => {
    i18n.activate('en')
    expect(i18n._(playGame)).toBe('PLAY GAME')
  })

  it('resolves the translation in Czech', () => {
    i18n.activate('cs')
    expect(i18n._(playGame)).toBe('HRÁT')
  })
})
