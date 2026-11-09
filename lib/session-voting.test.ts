import { describe, expect, it } from 'vitest'

import { votesFor, votingSession } from './session-voting'

const NOW = 1_000_000
const session = (id: string, opensAt: number, altModeId: string | null) => ({
  id,
  opensAt,
  closesAt: opensAt + 100,
  altModeId,
})

describe('votingSession', () => {
  it('is the first planned session when it has two candidates', () => {
    const rows = [session('b', NOW + 300, 'x'), session('a', NOW + 100, 'y')]
    expect(votingSession(rows, NOW)?.id).toBe('a')
  })

  it('is nothing when the first planned session has only one', () => {
    const rows = [session('a', NOW + 100, null), session('b', NOW + 300, 'x')]
    expect(votingSession(rows, NOW)).toBeNull()
  })

  it('is nothing while another session is running', () => {
    const rows = [session('live', NOW - 50, null), session('next', NOW + 100, 'x')]
    expect(votingSession(rows, NOW)).toBeNull()
  })

  it('ignores a session that is running or over', () => {
    const rows = [session('live', NOW - 50, 'x'), session('past', NOW - 500, 'y')]
    expect(votingSession(rows, NOW)).toBeNull()
  })

  it('is nothing with an empty queue', () => {
    expect(votingSession([], NOW)).toBeNull()
  })
})

describe('votesFor', () => {
  it('counts the voters who picked a candidate', () => {
    const voters = [{ modeId: 'a' }, { modeId: 'b' }, { modeId: 'a' }]
    expect(votesFor(voters, 'a')).toBe(2)
    expect(votesFor(voters, 'b')).toBe(1)
    expect(votesFor(voters, 'c')).toBe(0)
  })
})
