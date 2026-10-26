import { describe, expect, it } from 'vitest'

import { challengeId, type ModeId } from '@/modes'

import { runStats } from './run-stats'

const keysOf = (mode: ModeId) =>
  runStats({
    mode,
    hits: 12,
    gameTimeMs: 60_000,
    strikes: 3,
    avgAccuracy: 90,
    avgSpeed: 70,
  }).map((stat) => stat.key)

describe('runStats', () => {
  it('lists every stat on a run placed by its score', () => {
    expect(keysOf('accuracy')).toEqual(['hits', 'strikes', 'time', 'factor'])
  })

  it('leaves out the figure a run is placed on, which the screen already leads with', () => {
    expect(keysOf(challengeId('habit'))).not.toContain('time')
    expect(keysOf(challengeId('habit'))).toContain('hits')
    expect(keysOf(challengeId('no-slip'))).not.toContain('hits')
    expect(keysOf(challengeId('no-slip'))).toContain('time')
  })
})
