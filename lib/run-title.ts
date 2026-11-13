// The top bar's title: the colour it is painted in, NINE's own colour on it, and the line
// under it.

import type { MessageDescriptor } from '@lingui/core'

import {
  CHALLENGE_WORD,
  DIFFICULTIES,
  getDifficultyColor,
  gradientOf,
  isChallenge,
  type Difficulty,
  type ModeId,
} from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

// What the top bar is painted in.
//
// Every permanent mode opens on its own first stop. A **challenge**'s first stop is the
// near-black every challenge shares, so taking it would make every challenge's top bar
// identical and leave the name as the only thing saying which one this is. Its second
// stop is the challenge's own, and `challengeInk` is the shade of that which carries a
// word on the surface.
export const accentFor = (mode: ModeId): string =>
  isChallenge(mode) ? challengeInk(gradientOf(mode)[1]) : gradientOf(mode)[0]

// NINE's own colour on that bar. A challenge takes the same ink as the rest of the row
// rather than a point along its pair: `getDifficultyColor` lerps between the two stops by
// rung, and a challenge pins its rung — so the lerp returns the same blend of near-black
// and hue on every run, which is a colour neither stop is.
export const wordmarkFor = (mode: ModeId, difficulty: Difficulty): string =>
  isChallenge(mode) ? accentFor(mode) : getDifficultyColor(mode, difficulty)

// What the title is, under the title.
//
// A scored run says its rung. A **challenge** says that it is one — the name above it is
// a mode nobody has seen before and will not see again, so the line that would carry a
// rung is the only place left to say what kind of thing is being played. A challenge pins
// its own rung and so has none to report, which is exactly what leaves the line free.
//
// The descriptor rather than the string, so the one caller lower-cases it the same way it
// lower-cases a rung — that casing is the top bar's voice, not this decision's.
export const subtitleFor = (
  mode: ModeId,
  usesDifficulty: boolean,
  difficulty: Difficulty,
): MessageDescriptor | null => {
  if (isChallenge(mode)) return CHALLENGE_WORD
  return usesDifficulty ? DIFFICULTIES[difficulty].label : null
}
