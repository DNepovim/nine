import { Text, View } from 'react-native'

import type { ON_GOLD_LABEL_SHADOW } from '@/constants/theme'

// One number over its own label — the app's format for a row of stats, used by the run
// stats on the pause and game over screens and by the lifetime row on a player profile.
//
// The label sits underneath rather than beside the number so a cell is as wide as its
// widest line instead of as wide as both put together, which is what keeps `AVG ACC` on
// one line when a row runs out of room.

// How far a hanging mark is pulled out of the cell: one character of the value's own
// face. Every glyph in a monospace face has the same advance — near enough 0.6 em across
// SF Mono, Menlo and Roboto Mono — so the mark is exactly as wide as a digit, plus the
// tracking that follows it. Both numbers are the ones in the value's classes below and
// have to move with them; NativeWind needs those spelled out literally, so they cannot
// be derived from here.
const MARK_OVERHANG = 12 * 0.6 + 0.5

export function StatCell({
  label,
  value,
  shadow = null,
  overhang = false,
}: {
  label: string
  value: string
  // The halo the gold game over screen needs, where these sit straight on the
  // celebration. Passed in rather than decided here: the profile modal has its own
  // surface and wants none.
  shadow?: typeof ON_GOLD_LABEL_SHADOW | null
  // Whether the value ends in a unit mark that should hang outside the cell — the ″ on a
  // duration. Without it the cell centres the digits *and* the mark, which leaves the
  // number itself sitting left of the label under it and the whole row looking untidy.
  // The mark keeps its place beside the digits and simply stops counting towards what is
  // being centred.
  overhang?: boolean
}) {
  return (
    <View className="items-center">
      <Text
        selectable={false}
        numberOfLines={1}
        className="font-mono text-[12px] font-bold tracking-[0.5px] text-primary"
        style={[shadow, overhang ? { marginRight: -MARK_OVERHANG } : null]}
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
