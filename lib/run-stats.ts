import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import { formatGameTime } from '@/lib/duration'
import { headlineOf, measureOf, traitsOf, type Measure, type ModeId } from '@/modes'

// The figures a run leaves behind, named.
//
// Which numbers a run has is the engine's business — a scored run has hits, strikes, time
// and the factor its mode is judged on; an arcade run has strikes and time, with its depth
// standing above them as the score. How they are laid out is not: both are the same row of
// the same cells, drawn by `StatRow`. This file is the first half, that component is the
// second, and the pause screen and the game-over screen of either engine read both.
export type RunStat = {
  key: string
  label: MessageDescriptor
  value: string
  // The value ends in a unit mark, which hangs outside the cell so that the digits — not
  // the digits plus the mark — are what sits centred over the label. A percentage's % is
  // part of the number it is written on, and stays in.
  overhang: boolean
}

// The stat a run's **measure** already leads the screen with, and so leaves out of the
// row under it: the clock on a race, the hits on a hits session, nothing on the score —
// which is the readout itself rather than a stat. A map rather than the measure read as
// a key, so a stat added later cannot vanish from every run because its key happens to
// spell one.
const LED_BY = {
  score: null,
  time: 'time',
  hits: 'hits',
} as const satisfies Record<Measure, string | null>

// A run of the game machine: four numbers on a mode that keeps a board, three on one that
// does not.
export function runStats(run: {
  mode: ModeId
  hits: number
  // How long the run was actively played — not counting time in the pause menu, and
  // frozen the instant the screen appears rather than ticking while it is open.
  gameTimeMs: number
  // Hits that landed on a streak, over the whole run.
  strikes: number
  avgAccuracy: number
  avgSpeed: number
}): RunStat[] {
  // Only the mode's own factor. Accuracy runs are won on the route and Speed runs on the
  // clock, so the other mode's number is a stat about something the player was not being
  // asked for — and a mode with no board is not being measured on either, so it keeps
  // none. See `headline` on ScoringRules.
  const factor =
    headlineOf(run.mode) === 'spd'
      ? { label: msg`AVG SPD`, value: run.avgSpeed }
      : { label: msg`AVG ACC`, value: run.avgAccuracy }

  // A run whose standings are placed on the clock has already shown it, in the readout
  // at the top of the screen and to the hundredth. Printing it here again — rounded to
  // the second, in a row of things the run merely *did* — would be the one figure the
  // run is judged by said twice, less precisely the second time. A hits run's hits are
  // the same: they lead the screen, so they are not a stat under it. See `LED_BY`.
  const led = LED_BY[measureOf(run.mode)]

  return [
    { key: 'hits', label: msg`HITS`, value: `${run.hits}`, overhang: false },
    { key: 'strikes', label: msg`STRIKES`, value: `${run.strikes}`, overhang: false },
    {
      key: 'time',
      label: msg`TIME`,
      value: formatGameTime(run.gameTimeMs),
      overhang: true,
    },
    ...(traitsOf(run.mode).scored
      ? [
          {
            key: 'factor',
            label: factor.label,
            value: `${factor.value}%`,
            overhang: false,
          },
        ]
      : []),
  ].filter((stat) => stat.key !== led)
}

// An arcade run. Depth is not here: it is the score, so it stands above this in the
// readout the game puts its score in.
export const arcadeStats = (
  strikes: number,
  taken: number,
  playedMs: number,
): RunStat[] => [
  { key: 'strikes', label: msg`STRIKES`, value: `${strikes}`, overhang: false },
  // What the run took, beside what it did fast. The same kind of claim as the strikes:
  // not what the run was worth — that is the depth standing above these — but what
  // happened on the way up.
  //
  // Labelled by the thing rather than by what was done to it: TAKEN is already a string
  // in this app, on a medal a rival took *off* you, and it is translated accordingly —
  // reusing it here would have had the Czech card congratulate the player on three
  // villages they lost.
  { key: 'taken', label: msg`VILLAGES`, value: `${taken}`, overhang: false },
  { key: 'time', label: msg`TIME`, value: formatGameTime(playedMs), overhang: true },
]
