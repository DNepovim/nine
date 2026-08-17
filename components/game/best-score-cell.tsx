import { Text, View } from 'react-native'

// The mark hangs off the cell's own top-right, which is the number's top-right — the
// label sits to the left, so nothing else is over there. Being absolute is the point:
// a mark in the flow would widen the cell as it appeared, and the row is spaced with
// `justify-between`, so one record changing hands would shuffle all four scores.
const MARK_TOP = -2
const MARK_RIGHT = -8

// Deliberately not the seven-segment face the number wears: DSEG7 draws digits from
// segments and has no asterisk to draw.
const MARK = '*'

// One label + number pair in the best-scores line. The label stays in the shared
// dim ink; the number carries its own colour from the game spectrum so the four
// scores stay tellable apart at a glance.
//
// A record the player holds is marked rather than recoloured: the number's colour is
// what says which period it belongs to, and spending that on ownership would leave two
// gold cells that no longer read as different boards.
export function BestScoreCell({
  label,
  value,
  color,
  digitFont,
  mine = false,
  mineColor,
}: {
  label: string
  value: number
  color: string
  digitFont: string
  // Whether this board's record is the player's own.
  mine?: boolean
  // Gold that reads as text on the active theme — see GOLD_INK.
  mineColor?: string
}) {
  return (
    <View className="flex-row items-baseline gap-1">
      <Text
        selectable={false}
        className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
      >
        {label}
      </Text>
      <Text
        selectable={false}
        numberOfLines={1}
        className="text-[10px] tracking-[1px]"
        style={{ fontFamily: digitFont, color }}
      >
        {value}
      </Text>
      {mine && (
        <Text
          selectable={false}
          className="absolute font-mono text-[10px] font-bold"
          style={{ top: MARK_TOP, right: MARK_RIGHT, color: mineColor }}
        >
          {MARK}
        </Text>
      )}
    </View>
  )
}
