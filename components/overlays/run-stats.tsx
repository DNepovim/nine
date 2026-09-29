import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { View } from 'react-native'

import { StatCell } from '@/components/overlays/stat-cell'
import { ON_GOLD_LABEL_SHADOW } from '@/constants/theme'
import { formatGameTime } from '@/lib/duration'
import type { Mode } from '@/machines/modes'

// The numbers a run leaves behind, shown on both the pause and game-over screens. One
// component so the two can never drift apart.
//
// Each cell is a number over its own label. The label underneath rather than beside it
// is what lets a cell be as wide as its widest line instead of as wide as both put
// together — which is what used to squeeze `AVG ACC` onto two lines when the row ran out
// of room. It costs one line of height across the whole row, not four.

// Three to a line. Six numbers in one row would have each of them narrower than the
// label under it; two rows of three keep every cell as wide as it needs to be and give
// the run's shape and the run's quality a line each.
const PER_ROW = 3

const chunked = <T,>(cells: readonly T[]): T[][] => {
  const rows: T[][] = []
  for (let i = 0; i < cells.length; i += PER_ROW) rows.push(cells.slice(i, i + PER_ROW))
  return rows
}

export function RunStats({
  gameMode,
  hits,
  gameTimeMs,
  strikes,
  maxStreak,
  avgAccuracy,
  avgSpeed,
  bestAccuracy,
  bestSpeed,
  halo = false,
}: {
  // Which of the two factor stats to show, and whether there is a chain to report at
  // all. Decided here rather than at each screen, for the same reason the rest of this
  // component is: two callers, one answer.
  gameMode: Mode
  hits: number
  // How long the run has been actively played — not counting time in the pause menu,
  // and frozen the instant this screen appears rather than ticking while it is open.
  gameTimeMs: number
  // Hits that landed on a streak, over the whole run, and the longest that streak ever
  // got. The first says how much of the run was played well, the second how well.
  strikes: number
  maxStreak: number
  avgAccuracy: number
  avgSpeed: number
  // The best any one hit of the run managed. Sits beside its average, where the gap
  // between the two is the thing worth reading.
  bestAccuracy: number
  bestSpeed: number
  // Set on the gold game-over screen, where these sit straight on the celebration.
  halo?: boolean
}) {
  const { t } = useLingui()
  const shadow = halo ? ON_GOLD_LABEL_SHADOW : null

  // Only the mode's own factor. Accuracy runs are won on the route and Speed runs on
  // the clock, so the other mode's number is a stat about something the player was not
  // being asked for — and dropping it is what leaves room for the best beside it.
  const factor =
    gameMode === 'speed'
      ? {
          avg: msg`AVG SPD`,
          avgValue: avgSpeed,
          best: msg`BEST SPD`,
          bestValue: bestSpeed,
        }
      : {
          avg: msg`AVG ACC`,
          avgValue: avgAccuracy,
          best: msg`BEST ACC`,
          bestValue: bestAccuracy,
        }

  // TIME is the one value that ends in a unit mark, and its ″ hangs outside the cell so
  // that the digits — not the digits plus the mark — are what sits centred over the
  // label. A percentage's % is part of the number it is written on, and stays in.
  const cells = [
    { key: 'hits', label: msg`HITS`, value: `${hits}`, overhang: false },
    { key: 'time', label: msg`TIME`, value: formatGameTime(gameTimeMs), overhang: true },
    { key: 'strikes', label: msg`STRIKES`, value: `${strikes}`, overhang: false },
    // Trainee keeps neither the chain nor the factors. Its streak trigger is `none` —
    // the legacy board-clear rule rather than a chain of decisions — so a TOP CHAIN cell
    // there would read 0 for the whole of every run; and a practice mode with no board
    // is not being measured on a route or a clock. What is left is the three numbers
    // that still mean something: how much was hit, how long it took, and how much of it
    // cleared the board.
    ...(gameMode === 'trainee'
      ? []
      : [
          { key: 'chain', label: msg`TOP CHAIN`, value: `${maxStreak}`, overhang: false },
          {
            key: 'avg',
            label: factor.avg,
            value: `${factor.avgValue}%`,
            overhang: false,
          },
          {
            key: 'best',
            label: factor.best,
            value: `${factor.bestValue}%`,
            overhang: false,
          },
        ]),
  ]

  return (
    <View className="mb-6 w-full items-center gap-3">
      {chunked(cells).map((row) => (
        // Keyed on the row's first cell rather than its index: the rows a mode deals are
        // fixed, so the first key names the row as well as a counter would and survives
        // a mode change without React pairing one mode's row with another's.
        <View
          key={row[0]?.key}
          className="w-full flex-row items-start justify-center gap-5"
        >
          {row.map(({ key, label, value, overhang }) => (
            <StatCell
              key={key}
              label={t(label)}
              value={value}
              shadow={shadow}
              overhang={overhang}
            />
          ))}
        </View>
      ))}
    </View>
  )
}
