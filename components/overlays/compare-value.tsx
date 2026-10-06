import { Text } from 'react-native'

import { GOLD_INK } from '@/constants/colors'
import { cn } from '@/lib/cn'

// How wide a column of figures is. Four points wider than it was, bought for the caret
// below — the two columns still leave a 320pt phone room for ACHIEVEMENTS in the label.
const VALUE_WIDTH = 'w-[76px]'

// The mark in front of the better of the two. Colour alone decided every verdict on this
// screen until it arrived, and colour alone is the one thing a reader may not have: the gold
// and the dim are a hue apart before they are a brightness apart, and in sunlight on a phone
// they are neither. A caret costs four points of the column and says the same thing twice.
const LEADS = '▸'

// One cell of the comparison table: a figure, and whether it is the better of the two.
//
// Gold for the side that is ahead, and gold for the reason it means everywhere else in the
// app — a standing you currently hold and could lose tomorrow, which is exactly what
// leading a head-to-head is. `GOLD_INK` rather than `GOLD_SCALE`: the colour *is* the text
// here, and the scale is a background palette that cannot carry one.
//
// The side behind drops to dim rather than staying put, so the pair reads at a glance from
// the contrast between them instead of from a colour the eye has to find. A row nobody
// wins leaves both at full strength, which is what makes a judged row look judged.
export function CompareValue({
  text,
  tone,
}: {
  text: string
  // 'lead' and 'trail' are the two halves of a judged row; 'plain' is both halves of an
  // unjudged one, and both halves of a tie.
  tone: 'lead' | 'trail' | 'plain'
}) {
  return (
    <Text
      selectable={false}
      numberOfLines={1}
      className={cn(
        VALUE_WIDTH,
        'text-right font-mono text-[11px] font-bold',
        tone === 'trail' ? 'text-dim' : 'text-primary',
      )}
      style={tone === 'lead' ? { color: GOLD_INK } : undefined}
    >
      {/* The caret hangs off the left of the figure rather than displacing it: the column
          is right-aligned, so the digits of the two sides stay under each other whichever
          of them is wearing it. */}
      {tone === 'lead' ? `${LEADS} ${text}` : text}
    </Text>
  )
}
