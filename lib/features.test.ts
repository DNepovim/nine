import { describe, expect, it } from 'vitest'

import {
  knownFeatures,
  nextVisibility,
  parseVisibility,
  sameFeatures,
  sourceOf,
  toggleOverride,
} from './features'

describe('knownFeatures', () => {
  it('keeps the keys this build has guards for', () => {
    expect(knownFeatures(['arcade', 'challengeLab'])).toStrictEqual(
      new Set(['arcade', 'challengeLab']),
    )
  })

  it('drops a key the server knows and this build does not', () => {
    // A device older than the server. Dropping is the safe direction: an unknown key
    // can open nothing here, because nothing here asks about it.
    expect(knownFeatures(['arcade', 'siege'])).toStrictEqual(new Set(['arcade']))
  })

  it('reads an empty answer as nothing rather than everything', () => {
    expect(knownFeatures([])).toStrictEqual(new Set())
  })
})

describe('parseVisibility', () => {
  it('keeps the three positions the switch has', () => {
    expect(parseVisibility('hidden')).toBe('hidden')
    expect(parseVisibility('private')).toBe('private')
    expect(parseVisibility('public')).toBe('public')
  })

  it('reads a position this build has never heard of as private', () => {
    // A device older than the server. The player path never reads this column, so the
    // only cost is the admin screen describing an unfamiliar switch as the ordinary one.
    expect(parseVisibility('everybody-on-tuesdays')).toBe('private')
  })
})

describe('nextVisibility', () => {
  it('widens, then starts over', () => {
    // Nobody, then whoever holds it, then everybody — the order the three widen in.
    expect(nextVisibility('hidden')).toBe('private')
    expect(nextVisibility('private')).toBe('public')
    expect(nextVisibility('public')).toBe('hidden')
  })
})

describe('toggleOverride', () => {
  const row = (override: boolean | null, inRoleStack: boolean) =>
    ({ override, inRoleStack, visibility: 'private' }) as const

  it('takes a feature the role gives away, then gives it back by inheriting', () => {
    expect(toggleOverride(row(null, true))).toBe(false)
    expect(toggleOverride(row(false, true))).toBeNull()
  })

  it('grants a feature the role withholds, then drops back to inheriting', () => {
    expect(toggleOverride(row(null, false))).toBe(true)
    expect(toggleOverride(row(true, false))).toBeNull()
  })

  it('clears an override that only repeated the role', () => {
    // The state the three-way cycle used to stop on: on, and on anyway. One tap now
    // turns it off rather than merely relabelling it.
    expect(toggleOverride(row(true, true))).toBe(false)
    expect(toggleOverride(row(false, false))).toBe(true)
  })

  it('revokes a public feature even though no stack holds it', () => {
    // The thing `inRoleStack` alone got wrong: public is inherited too, so the first tap
    // on a public row has to write `false` rather than the `true` that was already true.
    expect(
      toggleOverride({ override: null, inRoleStack: false, visibility: 'public' }),
    ).toBe(false)
    expect(
      toggleOverride({ override: false, inRoleStack: false, visibility: 'public' }),
    ).toBeNull()
  })
})

describe('sourceOf', () => {
  it('says a hidden feature is hidden, whatever else the row says', () => {
    // Hidden beats all three of the others, so it is reported before any of them.
    expect(sourceOf({ override: true, inRoleStack: true, visibility: 'hidden' })).toBe(
      'hidden',
    )
  })

  it('names the role when there is no override', () => {
    expect(sourceOf({ override: null, inRoleStack: true, visibility: 'private' })).toBe(
      'role-on',
    )
    expect(sourceOf({ override: null, inRoleStack: false, visibility: 'private' })).toBe(
      'role-off',
    )
  })

  it('names the override when there is one, either way round', () => {
    expect(sourceOf({ override: true, inRoleStack: false, visibility: 'private' })).toBe(
      'override-on',
    )
    expect(sourceOf({ override: false, inRoleStack: true, visibility: 'private' })).toBe(
      'override-off',
    )
  })

  it('still calls it an override when it agrees with the role', () => {
    // Worth saying: a row that agrees with the role today will stop agreeing the moment
    // somebody edits the stack, and the screen should have warned that it was pinned.
    expect(sourceOf({ override: true, inRoleStack: true, visibility: 'private' })).toBe(
      'override-on',
    )
  })

  it('says public when nothing names the person', () => {
    expect(sourceOf({ override: null, inRoleStack: false, visibility: 'public' })).toBe(
      'public',
    )
  })

  it('lets a revoked override beat public', () => {
    // The same order the resolve reads in: public beats the stack, and an override beats
    // public. A feature taken away from one person by hand stays taken away when it goes
    // out to everybody, and this row is the only place that is visible.
    expect(sourceOf({ override: false, inRoleStack: true, visibility: 'public' })).toBe(
      'override-off',
    )
  })
})

describe('sameFeatures', () => {
  it('sees two spellings of the same set as the same', () => {
    expect(
      sameFeatures(
        new Set(['challengeLab', 'arcade']),
        new Set(['arcade', 'challengeLab']),
      ),
    ).toBe(true)
  })

  it('sees a different size as different', () => {
    expect(
      sameFeatures(new Set(['challengeLab']), new Set(['challengeLab', 'arcade'])),
    ).toBe(false)
  })

  it('sees the same size with a different member as different', () => {
    expect(sameFeatures(new Set(['challengeLab']), new Set(['arcade']))).toBe(false)
  })

  it('sees two empty sets as the same, which is the common case', () => {
    // All but a handful of players resolve to nothing, so this is the comparison that
    // runs on nearly every launch.
    expect(sameFeatures(new Set(), new Set())).toBe(true)
  })
})
