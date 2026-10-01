import { describe, expect, it } from 'vitest'

import {
  allModes,
  isMode,
  isModeId,
  isOpenMode,
  labelOf,
  MODE_ORDER,
  modeById,
  openModes,
  rulesFor,
  SCORED_MODES,
  traitsOf,
} from '.'

describe('the registry', () => {
  it('answers for every mode it holds, and for nothing else', () => {
    for (const mode of allModes()) {
      expect(isModeId(mode.id), mode.id).toBe(true)
      expect(modeById(mode.id), mode.id).toBe(mode)
    }
    expect(isModeId('nope')).toBe(false)
    expect(modeById('nope')).toBeNull()
  })

  it('keeps `Mode` to the modes the game machine runs', () => {
    // Arcade is registered and is not one: it is on its own engine, so nothing that
    // resolves rules may be handed it.
    for (const mode of MODE_ORDER) {
      expect(isMode(mode), mode).toBe(true)
      expect(modeById(mode)?.engine, mode).toBe('targets')
    }
    expect(isMode('arcade')).toBe(false)
    expect(rulesFor('arcade', 'hard')).toBeNull()
  })

  it('holds SCORED_MODES and the `scored` capability to the same answer', () => {
    // SCORED_MODES is written out because it has to produce a type; this is what keeps
    // it from drifting from the capability the engine actually reads.
    const scored = MODE_ORDER.filter((mode) => traitsOf(mode).scored)
    expect(scored).toEqual([...SCORED_MODES])
  })

  it('answers no to every trait for a mode nothing is registered under', () => {
    // Which is the safe answer in each case: nothing is shown, nothing is recorded.
    expect(traitsOf('challenge/gone')).toEqual({
      scored: false,
      coached: false,
      keyHints: false,
      usesDifficulty: false,
      engine: null,
    })
  })

  it('names a mode that has gone rather than crashing on it', () => {
    expect(labelOf('challenge/gone').message?.length ?? 0).toBeGreaterThan(0)
  })

  it('reads a mode on another engine as having no rules and no traits', () => {
    expect(traitsOf('arcade').engine).toBe('arcade')
    expect(traitsOf('arcade').scored).toBe(false)
  })
})

describe('which modes are open', () => {
  const NOW = Date.UTC(2026, 9, 1)

  it('always lists the permanent ones', () => {
    const open = openModes(NOW).map((mode) => mode.id)
    for (const mode of [...MODE_ORDER, 'arcade']) {
      expect(open, mode).toContain(mode)
    }
  })

  it('leaves a challenge out of every list once its window has closed', () => {
    const challenges = allModes().filter((mode) => mode.window !== null)
    expect(challenges.length).toBeGreaterThan(0)
    for (const mode of challenges) {
      const { from, until } = mode.window ?? { from: 0, until: 0 }
      expect(isOpenMode(mode, from)).toBe(true)
      expect(isOpenMode(mode, until - 1)).toBe(true)
      // Exclusive at the top, so two windows can meet without overlapping.
      expect(isOpenMode(mode, until)).toBe(false)
      expect(isOpenMode(mode, from - 1)).toBe(false)
    }
  })

  it('still answers for an expired challenge by name', () => {
    // Its id outlives its window: a stored run and a stat row both still name it.
    for (const mode of allModes().filter((m) => m.window !== null)) {
      expect(isModeId(mode.id)).toBe(true)
      expect(rulesFor(mode.id, 'hard')).not.toBeNull()
    }
  })
})
