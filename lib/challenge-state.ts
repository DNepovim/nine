// A **challenge state**: whether a challenge may be offered at all. `live` is the usual —
// it can be planned and its sessions are seen. `pending` holds it back. A fact about the
// challenge, set by an admin; not a session's status, which the clock decides.
export type ChallengeState = 'live' | 'pending'

export const isChallengeState = (value: unknown): value is ChallengeState =>
  value === 'live' || value === 'pending'

// What the gallery's one dot says about a challenge, strongest first: held back, then
// running now, then booked in the queue, then simply live. A running or planned challenge
// is necessarily live, so the order never contradicts the state — it only decides which of
// the true things is worth the corner.
export type ChallengeDot = 'pending' | 'running' | 'planned' | 'live'

export const CHALLENGE_DOTS = [
  'running',
  'planned',
  'live',
  'pending',
] as const satisfies readonly ChallengeDot[]

export function challengeDotOf({
  state,
  running,
  planned,
}: {
  state: ChallengeState
  running: boolean
  planned: boolean
}): ChallengeDot {
  if (state === 'pending') return 'pending'
  if (running) return 'running'
  if (planned) return 'planned'
  return 'live'
}

// How many challenges wear each dot, for the pills' counts — one pass, so the four always
// add up to the number of tiles.
export const tallyDots = (dots: readonly ChallengeDot[]): Record<ChallengeDot, number> =>
  dots.reduce<Record<ChallengeDot, number>>(
    (tally, dot) => {
      tally[dot] += 1
      return tally
    },
    { pending: 0, running: 0, planned: 0, live: 0 },
  )
