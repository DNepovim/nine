import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { View } from 'react-native'

import { StatCell } from '@/components/overlays/stat-cell'
import { ON_GOLD_LABEL_SHADOW } from '@/constants/theme'
import { formatGameTime } from '@/lib/duration'

// The four numbers a run leaves behind, shown on both the pause and game-over
// screens. One component so the two can never drift apart.
//
// A row of four columns, each number over its own label. The label underneath rather
// than beside it is what lets a cell be as wide as its widest line instead of as wide
// as both put together — which is what used to squeeze `AVG ACC` onto two lines when
// the row ran out of room. It costs one line of height across the whole row, not four.
export function RunStats({
  hits,
  gameTimeMs,
  avgAccuracy,
  avgSpeed,
  halo = false,
}: {
  hits: number
  // How long the run has been actively played — not counting time in the pause menu,
  // and frozen the instant this screen appears rather than ticking while it is open.
  gameTimeMs: number
  avgAccuracy: number
  avgSpeed: number
  // Set on the gold game-over screen, where these sit straight on the celebration.
  halo?: boolean
}) {
  const { t } = useLingui()
  const shadow = halo ? ON_GOLD_LABEL_SHADOW : null
  // TIME is the one value that ends in a unit mark, and its ″ hangs outside the cell so
  // that the digits — not the digits plus the mark — are what sits centred over the
  // label. A percentage's % is part of the number it is written on, and stays in.
  const cells = [
    { key: 'hits', label: msg`HITS`, value: `${hits}`, overhang: false },
    { key: 'time', label: msg`TIME`, value: formatGameTime(gameTimeMs), overhang: true },
    { key: 'acc', label: msg`AVG ACC`, value: `${avgAccuracy}%`, overhang: false },
    { key: 'spd', label: msg`AVG SPD`, value: `${avgSpeed}%`, overhang: false },
  ]

  return (
    <View className="mb-6 w-full flex-row items-start justify-center gap-5">
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
