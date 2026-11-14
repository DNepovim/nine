import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// One column heading over the per-board table, stacked rather than spelled across.
//
// Two words on two lines for the same reason `StatCell` puts its label under its number:
// stacked, a column is as wide as its widest word instead of as wide as both put
// together. Four columns and a spelled difficulty is what a 320pt phone holds, and
// `BEST SCORE` on one line is the thing that does not fit in it.
//
// Bottom-aligned by the row, so a one-word heading sits on the same line as the second
// word of a two-word one and the headings read as a single band rather than as four
// labels at four heights.
export function ProfileColumnHead({
  width,
  top,
  bottom,
}: {
  // One of `BOARD_COLUMNS` — the widths are declared beside the row that has to match
  // them, never picked again here.
  width: string
  // Absent on a heading that is one word, which is then simply the only line.
  top?: string
  bottom: string
}) {
  return (
    <View className={cn(width, 'items-end')}>
      {top !== undefined && (
        <Text
          selectable={false}
          numberOfLines={1}
          className={cn(TYPE.caption, 'text-dim')}
        >
          {top}
        </Text>
      )}
      <Text selectable={false} numberOfLines={1} className={cn(TYPE.caption, 'text-dim')}>
        {bottom}
      </Text>
    </View>
  )
}
