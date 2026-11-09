import { spanStatus, type SessionSpan } from '@/lib/challenge-session'

// **Voting in progress**: the first planned session, when it has two candidates and no
// session is running. That is the one that opens next, and the time left to its opening is
// the time left to vote — the gap between one session closing and the next opening, never
// while one is on. A later planned session is not being voted on yet, and neither is the
// first if it was booked with one challenge. This is what `next_vote_options` answers on
// the server, so the planner's list and the players' vote always agree on which session it
// is — the caller drops sessions of a held-back challenge first, which players cannot see
// and which the server therefore does not count as running.
export function votingSession<T extends SessionSpan & { altModeId: string | null }>(
  sessions: readonly T[],
  now: number,
): T | null {
  if (sessions.some((session) => spanStatus(session, now) === 'live')) return null
  const next = sessions
    .filter((session) => spanStatus(session, now) === 'upcoming')
    .sort((a, b) => a.opensAt - b.opensAt)[0]
  return next !== undefined && next.altModeId !== null ? next : null
}

// How many of a session's voters picked a candidate. The detail counts from the voters it
// lists rather than from a second read, so the figure beside a name and the list under it
// can never disagree.
export const votesFor = (voters: readonly { modeId: string }[], modeId: string): number =>
  voters.filter((voter) => voter.modeId === modeId).length
