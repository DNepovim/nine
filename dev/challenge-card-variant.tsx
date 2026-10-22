import { Pressable } from 'react-native'

import { ChallengeCard } from '@/components/overlays/challenge-card'
import type { OpenSession } from '@/lib/session-board'
import { challengeId } from '@/modes'

// The card is drawn from a session the server hands over, so in the gallery it is drawn
// from these. Four of them, and each is a state the real card cannot be asked to show on
// demand: a window is open or it is not, somebody has played it or nobody has, and the
// minute it closes in comes round once a day at most.
export type ChallengeCase = 'leader' | 'fresh' | 'last-minute' | 'teaser'

// What each button says. Here rather than in the gallery's own catalogue, so the label and
// the case it draws cannot come to disagree.
export const CHALLENGE_TAG = {
  leader: 'LEADER',
  fresh: 'NOBODY YET',
  'last-minute': 'LAST MINUTE',
  teaser: 'TEASER',
} as const satisfies Record<ChallengeCase, string>

const MINUTE = 60_000
const HOUR = 60 * MINUTE

// The one challenge the catalog holds. A real id rather than a made-up one, because the
// card reads its name, its description and its colour out of the registry — a session
// naming a mode this build has never heard of is one the app drops rather than draws.
const MODE_ID = challengeId('four-keys')

// A session, as the server would have sent it. `opensAt` and `closesAt` are worked out
// from the moment the button is pressed rather than written as dates, so the countdown in
// the corner is always the figure the case is about: a card mocked with a fixed afternoon
// in September reads 0ʰ for the rest of the app's life.
const sessionFor = (which: ChallengeCase, now: number): OpenSession => {
  switch (which) {
    // Most of a day still to run, and a score worth chasing. Five figures, which is what
    // a good Speed run comes to — the leader line is the half of this card that has to
    // hold a name and a number side by side.
    case 'leader':
      return {
        id: 'dev-session-leader',
        modeId: MODE_ID,
        opensAt: now - 7 * HOUR,
        closesAt: now + 7 * HOUR,
        extendedAt: null,
        measure: 'score',
        // Vivid at both ends, so the long name shows the gradient travelling its whole
        // length — which is the thing a one-colour name could never show.
        leader: {
          nickname: 'Žluťoučký_kůň99',
          score: 184220,
          // Every card here is score-measured, so none of them has a time to show.
          timeMs: null,
          avgAccuracy: 94,
          avgSpeed: 91,
        },
      }
    // Open, and nobody has touched it. The line the card says instead of a leader.
    case 'fresh':
      return {
        id: 'dev-session-fresh',
        modeId: MODE_ID,
        opensAt: now - 20 * MINUTE,
        closesAt: now + 40 * MINUTE,
        extendedAt: null,
        measure: 'score',
        leader: null,
      }
    // The last minute of a window, which is the one stretch where the coarse figure drops
    // to a single unit — there being nothing under a second to pair it with.
    case 'last-minute':
      return {
        id: 'dev-session-closing',
        modeId: MODE_ID,
        opensAt: now - 23 * HOUR,
        closesAt: now + 45_000,
        measure: 'score',
        // The one case here carrying an extension, so the gallery shows the line a card
        // wears for the rest of a window it was given more time in. A window in its last
        // minute is also where that line matters most.
        extendedAt: now - 2 * HOUR,
        // Three characters and lopsided: exact and slow, so the name is nearly one
        // colour and the little it does travel is visible at the shortest length a
        // nickname comes in.
        leader: {
          nickname: 'Mia',
          score: 98430,
          timeMs: null,
          avgAccuracy: 96,
          avgSpeed: 42,
        },
      }
    // Not open yet: the name, the time until it opens, and its one-line description in
    // place of a leader nobody can be.
    case 'teaser':
      return {
        id: 'dev-session-teaser',
        modeId: MODE_ID,
        opensAt: now + 18 * HOUR,
        closesAt: now + 42 * HOUR,
        // Eighteen hours out: not open yet, which is what makes it a teaser card.
        extendedAt: null,
        measure: 'score',
        // Never counted, which `nameColors` reads as no saturation — the one case where
        // the name comes out grey. Drawn by nothing on the teaser, which shows its
        // description instead, and kept here so the shape is a whole `OpenSession`.
        leader: {
          nickname: 'nobody',
          score: 0,
          timeMs: null,
          avgAccuracy: null,
          avgSpeed: null,
        },
      }
  }
}

// The challenge card on its own, at the top of an empty screen.
//
// The real component with a real session rather than a drawing of it: what is being
// looked at is the frame around it — a swept gradient edge with the word CHALLENGES cut
// into it — and the rows inside, both of which measure themselves against the width the
// card is given. So it is given the width it has in the app: the screen's own padding,
// which is what the ALONE panel hands it.
export function ChallengeCardVariant({
  which,
  onClose,
}: {
  which: ChallengeCase
  onClose: () => void
}) {
  const session = sessionFor(which, Date.now())
  const state = which === 'teaser' ? 'teaser' : 'live'

  return (
    <Pressable className="flex-1 bg-surface px-4 py-2" onPress={onClose}>
      <ChallengeCard card={{ state, session }} onPress={onClose} />
    </Pressable>
  )
}
