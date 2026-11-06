import type { VoteOption } from '@/lib/session-ratings'

// The **queue** read two at a time. The first pair is the vote's two candidates; every pair
// after is the two that will be. Not stored — the queue is a flat list in the order it
// opens, and a pair is only how the planner draws it. A queue of odd length ends on a pair
// with nothing second.
export type Pair<T> = { first: T; second: T | null }

export function pairsOf<T>(queue: readonly T[]): Pair<T>[] {
  const pairs: Pair<T>[] = []
  for (let i = 0; i < queue.length; i += 2) {
    const first = queue[i]
    if (first === undefined) break
    pairs.push({ first, second: queue[i + 1] ?? null })
  }
  return pairs
}

// A pair as the planner draws it: the one with more votes on top. A tie keeps booking
// order. Counts are `null` unless this pair is the vote's two — a later pair has no vote
// yet, and a lone session has nothing to be voted against.
export type DrawnPair<T> = {
  top: T
  bottom: T | null
  topVotes: number | null
  bottomVotes: number | null
}

export function withVotes<T extends { id: string }>(
  pair: Pair<T>,
  options: readonly VoteOption[],
): DrawnPair<T> {
  const { first, second } = pair
  const votesOf = (id: string) => options.find((option) => option.sessionId === id)?.votes
  const firstVotes = votesOf(first.id)
  const secondVotes = second === null ? undefined : votesOf(second.id)
  if (second === null || firstVotes === undefined || secondVotes === undefined) {
    return { top: first, bottom: second, topVotes: null, bottomVotes: null }
  }
  return secondVotes > firstVotes
    ? { top: second, bottom: first, topVotes: secondVotes, bottomVotes: firstVotes }
    : { top: first, bottom: second, topVotes: firstVotes, bottomVotes: secondVotes }
}
