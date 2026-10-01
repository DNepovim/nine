import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { View } from 'react-native'

import { StatCell } from '@/components/overlays/stat-cell'
import { ON_GOLD_LABEL_SHADOW } from '@/constants/theme'
import { formatGameTime } from '@/lib/duration'
import { headlineOf, traitsOf, type ModeId } from '@/modes'

// The numbers a run leaves behind, shown on both the pause and game-over screens. One
// component so the two can never drift apart.
//
// Each cell is a number over its own label. The label underneath rather than beside it
// is what lets a cell be as wide as its widest line instead of as wide as both put
// together — which is what used to squeeze `AVG ACC` onto two lines when the row ran out
// of room. It costs one line of height across the whole row, not four.

// One line, whatever the mode: four numbers on a run that keeps a board and three on a
// run that does not.
//
// Centred as a group, with one fixed gap between cells, rather than cut into equal
// shares or spread across the width. Each cell is as wide as its own widest line, so
// equal columns would have left `AVG SPD` crowding its neighbours while `TIME` floated in
// the middle of empty space. A constant gap keeps the spacing the same on a run of three
// numbers and a run of four, and centring is what stops three of them sitting off to one
// side of a row sized for four.
export function RunStats({
  gameMode,
  hits,
  gameTimeMs,
  strikes,
  avgAccuracy,
  avgSpeed,
  halo = false,
}: {
  // Which of the two factor stats to show, and whether there is one to show at all —
  // both read off the mode's own rules below. Decided here rather than at each screen,
  // for the same reason the rest of this component is: two callers, one answer.
  gameMode: ModeId
  hits: number
  // How long the run has been actively played — not counting time in the pause menu,
  // and frozen the instant this screen appears rather than ticking while it is open.
  gameTimeMs: number
  // Hits that landed on a streak, over the whole run.
  strikes: number
  avgAccuracy: number
  avgSpeed: number
  // Set on the gold game-over screen, where these sit straight on the celebration.
  halo?: boolean
}) {
  const { t } = useLingui()
  // A mode with no board is not being measured on a route or a clock, and the one it is
  // measured on is its own answer — see `headline` on ScoringRules.
  const scored = traitsOf(gameMode).scored
  const headline = headlineOf(gameMode)
  const shadow = halo ? ON_GOLD_LABEL_SHADOW : null

  // Only the mode's own factor. Accuracy runs are won on the route and Speed runs on the
  // clock, so the other mode's number is a stat about something the player was not being
  // asked for.
  const factor =
    headline === 'spd'
      ? { label: msg`AVG SPD`, value: avgSpeed }
      : { label: msg`AVG ACC`, value: avgAccuracy }

  // TIME is the one value that ends in a unit mark, and its ″ hangs outside the cell so
  // that the digits — not the digits plus the mark — are what sits centred over the
  // label. A percentage's % is part of the number it is written on, and stays in.
  const cells = [
    { key: 'hits', label: msg`HITS`, value: `${hits}`, overhang: false },
    { key: 'strikes', label: msg`STRIKES`, value: `${strikes}`, overhang: false },
    { key: 'time', label: msg`TIME`, value: formatGameTime(gameTimeMs), overhang: true },
    // A mode with no board keeps no factor: what is left is the three numbers that still
    // mean something — how much was hit, how much of it cleared the board, and how long
    // it took.
    ...(!scored
      ? []
      : [
          {
            key: 'factor',
            label: factor.label,
            value: `${factor.value}%`,
            overhang: false,
          },
        ]),
  ]

  return (
    // No wrapper around each cell: `StatCell` sizes itself to its value so that a hanging
    // unit mark can be pulled back out of it, and that is exactly the width the spacing
    // needs to work from.
    <View className="mb-6 w-full flex-row items-start justify-center gap-x-5">
      {cells.map(({ key, label, value, overhang }) => (
        <StatCell
          key={key}
          label={t(label)}
          value={value}
          shadow={shadow}
          overhang={overhang}
        />
      ))}
    </View>
  )
}
