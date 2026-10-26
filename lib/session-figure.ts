import { formatRaceTime } from '@/lib/duration'
import { groupDigits } from '@/lib/group-digits'
import type { SessionFigures } from '@/lib/session-order'
import type { Measure } from '@/modes'

// The figure a **session board** placed somebody on, as one string: the score, the clock
// on a race, the targets taken on a hits session. Its own function because three
// surfaces print a settled place — the summary's podium, the player's own line under it,
// and a profile's place rows — and each used to choose between two figures with its own
// ternary, which a third measure would have turned into three nested ones.
//
// A race posted by a build older than the clock has no time to print, and reads as a
// dash rather than as a nought somebody could be thought to have run.

const FIGURE = {
  score: ({ score }) => groupDigits(score),
  time: ({ timeMs }) => (timeMs === null ? '—' : formatRaceTime(timeMs)),
  hits: ({ hits }) => groupDigits(hits),
} as const satisfies Record<Measure, (figures: SessionFigures) => string>

export const sessionFigure = (measure: Measure, figures: SessionFigures): string =>
  FIGURE[measure](figures)
