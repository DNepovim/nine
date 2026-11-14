import { describe, expect, it } from 'vitest'

import { sectionOrder } from './how-to-play-sections'

describe('sectionOrder', () => {
  it('offers every section to a reader who can reach every door', () => {
    expect(sectionOrder(true, true, true)).toEqual([
      'goal',
      'controls',
      'targets',
      'modes',
      'challenges',
      'arcade',
      'champions',
      'achievements',
      'multiplayer',
      'tips',
    ])
  })

  it('leaves out each gated chapter with the door that leads to it', () => {
    const shown = sectionOrder(false, false, false)
    expect(shown).not.toContain('multiplayer')
    expect(shown).not.toContain('arcade')
    expect(shown).not.toContain('challenges')
    expect(shown).toContain('tips')
  })

  it('answers each gate on its own', () => {
    expect(sectionOrder(true, false, false)).toContain('multiplayer')
    expect(sectionOrder(false, true, false)).toContain('arcade')
    expect(sectionOrder(false, false, true)).toContain('challenges')
  })
})
