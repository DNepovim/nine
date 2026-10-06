import { describe, expect, it } from 'vitest'

import { cycleOverride, knownFeatures, sourceOf } from './features'

describe('knownFeatures', () => {
  it('keeps the keys this build has guards for', () => {
    expect(knownFeatures(['arcade', 'dev'])).toStrictEqual(new Set(['arcade', 'dev']))
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

describe('cycleOverride', () => {
  it('goes inherit, on, off, and back', () => {
    expect(cycleOverride(null)).toBe(true)
    expect(cycleOverride(true)).toBe(false)
    expect(cycleOverride(false)).toBeNull()
  })
})

describe('sourceOf', () => {
  it('says a feature nobody can reach is off for everyone', () => {
    // The master switch beats both, so it is reported before either.
    expect(sourceOf({ override: true, inRoleStack: true, active: false })).toBe(
      'inactive',
    )
  })

  it('names the role when there is no override', () => {
    expect(sourceOf({ override: null, inRoleStack: true, active: true })).toBe('role-on')
    expect(sourceOf({ override: null, inRoleStack: false, active: true })).toBe(
      'role-off',
    )
  })

  it('names the override when there is one, either way round', () => {
    expect(sourceOf({ override: true, inRoleStack: false, active: true })).toBe(
      'override-on',
    )
    expect(sourceOf({ override: false, inRoleStack: true, active: true })).toBe(
      'override-off',
    )
  })

  it('still calls it an override when it agrees with the role', () => {
    // Worth saying: a row that agrees with the role today will stop agreeing the moment
    // somebody edits the stack, and the screen should have warned that it was pinned.
    expect(sourceOf({ override: true, inRoleStack: true, active: true })).toBe(
      'override-on',
    )
  })
})
