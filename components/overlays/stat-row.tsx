import { useLingui } from '@lingui/react/macro'
import { View } from 'react-native'

import { StatCell } from '@/components/overlays/stat-cell'
import { ON_GOLD_LABEL_SHADOW } from '@/constants/theme'
import type { RunStat } from '@/lib/run-stats'

// The row a run's figures are laid out in, wherever a run ends up being described.
//
// The layout rather than the figures: which numbers a run has is the engine's business —
// a scored run has hits, strikes, time and the factor its mode is judged on, an arcade
// run has strikes and time — and both are the same row of the same cells, so there is
// one of it. It used to be two components with the same body, and they had already drifted
// by a margin.
//
// Each cell is a number over its own label. The label underneath rather than beside it is
// what lets a cell be as wide as its widest line instead of as wide as both put together
// — which is what used to squeeze `AVG ACC` onto two lines when the row ran out of room.
// It costs one line of height across the whole row, not four.
//
// Centred as a group, with one fixed gap between cells, rather than cut into equal shares
// or spread across the width. Each cell is as wide as its own widest line, so equal
// columns would have left `AVG SPD` crowding its neighbours while `TIME` floated in the
// middle of empty space. A constant gap keeps the spacing the same on a run of two
// numbers and a run of four, and centring is what stops the short row sitting off to one
// side of a row sized for the long one.
export function StatRow({
  stats,
  halo = false,
}: {
  stats: readonly RunStat[]
  // Set on the gold game-over screen, where these sit straight on the celebration.
  halo?: boolean
}) {
  const { t } = useLingui()
  const shadow = halo ? ON_GOLD_LABEL_SHADOW : null

  return (
    // No wrapper around each cell: `StatCell` sizes itself to its value so that a hanging
    // unit mark can be pulled back out of it, and that is exactly the width the spacing
    // needs to work from.
    <View className="mb-6 w-full flex-row items-start justify-center gap-x-5">
      {stats.map(({ key, label, value, overhang }) => (
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
