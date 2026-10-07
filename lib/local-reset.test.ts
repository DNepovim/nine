import { describe, expect, it } from 'vitest'

import * as STORAGE from '@/constants/storage'
import { KEPT_KEYS, RESET_KEYS } from '@/lib/local-reset'

// Every storage key the app has, read off the module rather than listed again here — a
// second list would be a third thing to keep in step, which is the problem this test
// exists to prevent.
//
// `RETIRED_KEYS` is an array, not a key, and is filtered out by its type: those keys are
// already cleared on every boot by `purgeRetiredStorage`, so a restore has nothing to say
// about them.
const ALL_KEYS = Object.values(STORAGE).flatMap((value) =>
  typeof value === 'string' ? [value] : [],
)

describe('the restore lists', () => {
  it('names every key, so a new one cannot slip through undecided', () => {
    const decided = new Set<string>([...RESET_KEYS, ...KEPT_KEYS])
    const undecided = ALL_KEYS.filter((key) => !decided.has(key))
    expect(undecided).toEqual([])
  })

  it('names no key twice', () => {
    const kept = new Set<string>(KEPT_KEYS)
    expect(RESET_KEYS.filter((key) => kept.has(key))).toEqual([])
  })

  it('names nothing that is not a key', () => {
    const all = new Set(ALL_KEYS)
    expect([...RESET_KEYS, ...KEPT_KEYS].filter((key) => !all.has(key))).toEqual([])
  })

  it('clears the records of play', () => {
    expect(RESET_KEYS).toContain(STORAGE.LOCAL_SCORES_KEY)
    expect(RESET_KEYS).toContain(STORAGE.ACHIEVEMENTS_KEY)
    expect(RESET_KEYS).toContain(STORAGE.CAREER_KEY)
    expect(RESET_KEYS).toContain(STORAGE.STATS_KEY)
  })

  it('keeps the welcome marker, so a restore does not reopen the tutorial', () => {
    expect(KEPT_KEYS).toContain(STORAGE.WELCOME_KEY)
  })

  it('keeps the language and the recording consent, which are the phone owner’s', () => {
    expect(KEPT_KEYS).toContain(STORAGE.LOCALE_KEY)
    expect(KEPT_KEYS).toContain(STORAGE.REPLAY_CONSENT_KEY)
  })
})
