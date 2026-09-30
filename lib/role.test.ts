import { describe, expect, it } from 'vitest'

import { holds, parseRole } from './role'

describe('parseRole', () => {
  it('reads each of the three roles', () => {
    expect(parseRole('tester')).toBe('tester')
    expect(parseRole('developer')).toBe('developer')
    expect(parseRole('admin')).toBe('admin')
  })

  it('reads a player with no role as null', () => {
    expect(parseRole(null)).toBeNull()
    expect(parseRole(undefined)).toBeNull()
  })

  it('refuses a role this build does not know', () => {
    expect(parseRole('owner')).toBeNull()
  })

  it('is case sensitive, so a near miss is not a promotion', () => {
    expect(parseRole('Admin')).toBeNull()
  })

  it('refuses a value that is not a string at all', () => {
    expect(parseRole(3)).toBeNull()
    expect(parseRole({ role: 'admin' })).toBeNull()
  })
})

describe('holds', () => {
  it('gives a player with no role nothing', () => {
    expect(holds(null, 'tester')).toBe(false)
    expect(holds(null, 'admin')).toBe(false)
  })

  it('gives a role its own floor', () => {
    expect(holds('tester', 'tester')).toBe(true)
    expect(holds('admin', 'admin')).toBe(true)
  })

  it('gives a higher role everything a lower one reaches', () => {
    expect(holds('developer', 'tester')).toBe(true)
    expect(holds('admin', 'tester')).toBe(true)
    expect(holds('admin', 'developer')).toBe(true)
  })

  it('does not let a lower role reach a higher floor', () => {
    expect(holds('tester', 'developer')).toBe(false)
    expect(holds('tester', 'admin')).toBe(false)
    expect(holds('developer', 'admin')).toBe(false)
  })
})
