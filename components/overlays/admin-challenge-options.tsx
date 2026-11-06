import { Plural } from '@lingui/react/macro'

import type { AdminOption } from '@/components/overlays/admin-select'
import { ChallengeTitle } from '@/components/overlays/admin-session-cells'
import { ChallengeMark } from '@/components/overlays/challenge-mark'
import { TYPE } from '@/constants/typography'
import type { PastRuns } from '@/lib/challenge-session'
import { timeAgo } from '@/lib/time-ago'
import { gradientOf } from '@/modes'
import { CHALLENGES } from '@/modes/challenges/catalog'
import { challengeInk } from '@/modes/challenges/palette'

// The mark beside each name in a challenge field, at the size the field's one line holds
// without growing.
const MARK_SIZE = 20

// The options of every challenge field in the planner: the session form's, and each of the
// PLAN SESSION dialog's two. Every challenge written, not only the ones whose compiled
// window happens to be open — when a challenge is on stopped being a build-time fact — each
// with its mark and its own colours, how many times it has already run and how long ago it
// last did: the figures an admin choosing the next one is choosing by.
//
// A **pending** challenge is not offered, because the server would refuse it. `keep` is
// the one exception — the session being edited is already booked for it, and a field that
// had lost its own value would read as nothing chosen.
export function challengeOptions({
  pastRuns,
  now,
  pending,
  keep = null,
}: {
  pastRuns: ReadonlyMap<string, PastRuns>
  now: number
  pending: ReadonlySet<string>
  keep?: string | null
}): AdminOption<string>[] {
  return CHALLENGES.filter(
    (challenge) => !pending.has(challenge.id) || challenge.id === keep,
  ).map((challenge) => {
    // Sessions, not runs: a run is one game, and this counts closed sessions.
    const runs = pastRuns.get(challenge.id)
    return {
      value: challenge.id,
      icon: (
        <ChallengeMark
          modeId={challenge.id}
          color={challengeInk(gradientOf(challenge.id)[1])}
          size={MARK_SIZE}
        />
      ),
      label: <ChallengeTitle modeId={challenge.id} className={TYPE.buttonSm} />,
      note:
        runs === undefined ? undefined : (timeAgo(runs.lastClosedAt, now) ?? undefined),
      detail: <Plural value={runs?.count ?? 0} one="# SESSION" other="# SESSIONS" />,
    }
  })
}
