import { describe, expect, it } from 'vitest'

import type { VerdictKey } from './compare'
import { verdictLine } from './compare-lines'

// The English out of a descriptor, which is what a catalog-less test has to stand in for
// `t`. `message` is what the macro leaves on it before any locale has been loaded.
const en = (descriptor: { message?: string }): string => descriptor.message ?? ''

const KEYS: readonly VerdictKey[] = [
  'routMine',
  'routTheirs',
  'clearMine',
  'clearTheirs',
  'closeMine',
  'closeTheirs',
  'even',
  'unplayed',
]

describe('verdictLine', () => {
  it('says the same thing twice for the same table', () => {
    expect(verdictLine('clearMine', 'a:b:4-1', en)).toBe(
      verdictLine('clearMine', 'a:b:4-1', en),
    )
  })

  it('says something new once the score has moved', () => {
    const lines = new Set(
      ['4-1', '5-1', '6-1', '4-2'].map((score) =>
        verdictLine('clearMine', `a:b:${score}`, en),
      ),
    )
    expect(lines.size).toBeGreaterThan(1)
  })

  it('has a line for every verdict there is', () => {
    for (const key of KEYS) {
      expect(verdictLine(key, 'a:b:0-0', en)).not.toBe('')
    }
  })

  it('never names a player, so no variant has to inflect a nickname', () => {
    for (const key of KEYS) {
      for (let seed = 0; seed < 40; seed++) {
        expect(verdictLine(key, `a:b:${seed}`, en)).not.toMatch(/\[\w+\]|\{\w+\}/)
      }
    }
  })
})
