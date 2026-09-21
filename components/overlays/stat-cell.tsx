import { Text, View } from 'react-native'

import type { ON_GOLD_LABEL_SHADOW } from '@/constants/theme'

// One number over its own label — the app's format for a row of stats, used by the run
// stats on the pause and game over screens and by the lifetime row on a player profile.
//
// The label sits underneath rather than beside the number so a cell is as wide as its
// widest line instead of as wide as both put together, which is what keeps `AVG ACC` on
// one line when a row runs out of room.
export function StatCell({
  label,
  value,
  shadow = null,
}: {
  label: string
  value: string
  // The halo the gold game over screen needs, where these sit straight on the
  // celebration. Passed in rather than decided here: the profile modal has its own
  // surface and wants none.
  shadow?: typeof ON_GOLD_LABEL_SHADOW | null
}) {
  return (
    <View className="items-center">
      <Text
        selectable={false}
        numberOfLines={1}
        className="font-mono text-[12px] font-bold tracking-[0.5px] text-primary"
        style={shadow}
      >
        {value}
      </Text>
      <Text
        selectable={false}
        numberOfLines={1}
        className="mt-0.5 font-mono text-[8px] font-bold tracking-[1px] text-dim"
        style={shadow}
      >
        {label}
      </Text>
    </View>
  )
}
