import { describe, expect, it } from 'vitest'

import { challengeDotOf, isChallengeState, tallyDots } from './challenge-state'

describe('challengeDotOf', () => {
  it('lets pending beat everything', () => {
    expect(challengeDotOf({ state: 'pending', running: true, planned: true })).toBe(
      'pending',
    )
  })

  it('puts running before planned before live', () => {
    expect(challengeDotOf({ state: 'live', running: true, planned: true })).toBe(
      'running',
    )
    expect(challengeDotOf({ state: 'live', running: false, planned: true })).toBe(
      'planned',
    )
    expect(challengeDotOf({ state: 'live', running: false, planned: false })).toBe('live')
  })
})

describe('tallyDots', () => {
  it('counts every tile exactly once', () => {
    const tally = tallyDots(['live', 'live', 'pending', 'running', 'planned', 'live'])
    expect(tally).toEqual({ live: 3, pending: 1, running: 1, planned: 1 })
  })
})

describe('isChallengeState', () => {
  it('knows the two states', () => {
    expect(isChallengeState('live')).toBe(true)
    expect(isChallengeState('pending')).toBe(true)
    expect(isChallengeState('draft')).toBe(false)
    expect(isChallengeState(null)).toBe(false)
  })
})
