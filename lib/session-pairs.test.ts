import { describe, expect, it } from 'vitest'

import { pairsOf, withVotes } from './session-pairs'
import type { VoteOption } from './session-ratings'

const option = (sessionId: string, votes: number): VoteOption => ({
  sessionId,
  modeId: 'challenge/x',
  votes,
  mine: false,
  canVote: true,
})

describe('pairsOf', () => {
  it('chunks a queue in twos, the last one alone when it is odd', () => {
    expect(pairsOf([])).toEqual([])
    expect(pairsOf([1])).toEqual([{ first: 1, second: null }])
    expect(pairsOf([1, 2])).toEqual([{ first: 1, second: 2 }])
    expect(pairsOf([1, 2, 3])).toEqual([
      { first: 1, second: 2 },
      { first: 3, second: null },
    ])
    expect(pairsOf([1, 2, 3, 4])).toHaveLength(2)
  })
})

describe('withVotes', () => {
  const pair = { first: { id: 'a' }, second: { id: 'b' } }

  it('puts the one with more votes on top', () => {
    const drawn = withVotes(pair, [option('a', 2), option('b', 5)])
    expect(drawn).toEqual({
      top: { id: 'b' },
      bottom: { id: 'a' },
      topVotes: 5,
      bottomVotes: 2,
    })
  })

  it('keeps booking order on a tie', () => {
    expect(withVotes(pair, [option('a', 3), option('b', 3)]).top).toEqual({ id: 'a' })
  })

  it('carries no counts when the pair is not the vote', () => {
    const drawn = withVotes(pair, [option('x', 1), option('y', 9)])
    expect(drawn).toEqual({
      top: { id: 'a' },
      bottom: { id: 'b' },
      topVotes: null,
      bottomVotes: null,
    })
  })

  it('carries no counts for a lone session', () => {
    expect(
      withVotes({ first: { id: 'a' }, second: null }, [option('a', 4)]).topVotes,
    ).toBeNull()
  })
})
