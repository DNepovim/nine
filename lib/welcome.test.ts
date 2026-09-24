import { describe, expect, it } from 'vitest'

import {
  NOT_WELCOMED,
  parseWelcome,
  serializeWelcome,
  WELCOMED,
  welcomeLaunch,
} from './welcome'

describe('parseWelcome', () => {
  it('reports a missing value as never asked', () => {
    expect(parseWelcome(null)).toBeNull()
  })

  it('reads an install that opened with the welcome run', () => {
    expect(parseWelcome('{"welcomed":true}')).toEqual(WELCOMED)
  })

  it('reads an install that was already playing before it existed', () => {
    expect(parseWelcome('{"welcomed":false}')).toEqual(NOT_WELCOMED)
  })

  it('treats a stored object with no flag as not welcomed', () => {
    expect(parseWelcome('{}')).toEqual(NOT_WELCOMED)
  })

  it('falls back to never asked for malformed JSON', () => {
    expect(parseWelcome('{oops')).toBeNull()
  })

  it('falls back to never asked for a value of the wrong shape', () => {
    expect(parseWelcome('{"welcomed":"yes"}')).toBeNull()
  })

  it('round-trips through serialize', () => {
    expect(parseWelcome(serializeWelcome(WELCOMED))).toEqual(WELCOMED)
  })
})

describe('welcomeLaunch', () => {
  it('opens into a Trainee run on a device that has never been asked or played', () => {
    expect(welcomeLaunch(null, false)).toBe('start')
  })

  it('leaves a player who already has runs behind them on the intro', () => {
    expect(welcomeLaunch(null, true)).toBe('skip')
  })

  it('welcomes nobody twice', () => {
    expect(welcomeLaunch(WELCOMED, false)).toBe('skip')
  })

  it('does not re-ask an install that already answered no', () => {
    expect(welcomeLaunch(NOT_WELCOMED, false)).toBe('skip')
  })
})
