import { View } from 'react-native'

import type { BadgeCorner } from '@/components/game/dial-badge'
import { DIAL_CORNERS } from '@/constants/dial-hints'

// Four dots in a square, one of them filled: which corner of a key is being set.
//
// The same shape as the tile grid it is opened from and as the key itself, so the
// dialog says where it lands before the title is read. Small enough to ride the header
// beside a title, which is the only place it appears.
const DOT = 5
const GAP = 3

export function CornerMark({ corner, color }: { corner: BadgeCorner; color: string }) {
  return (
    <View
      style={{
        width: DOT * 2 + GAP,
        height: DOT * 2 + GAP,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GAP,
      }}
    >
      {/* DIAL_CORNERS reads top-left, top-right, bottom-left, bottom-right — the order
          a wrapping row lays them out in, so the grid needs no positioning of its own. */}
      {DIAL_CORNERS.map((one) => (
        <View
          key={one}
          style={{
            width: DOT,
            height: DOT,
            borderRadius: DOT / 2,
            borderWidth: 1,
            borderColor: color,
            // The empty three are outlines in the same colour, held back far enough
            // that the filled one is the thing the eye lands on.
            backgroundColor: one === corner ? color : 'transparent',
            opacity: one === corner ? 1 : 0.4,
          }}
        />
      ))}
    </View>
  )
}
