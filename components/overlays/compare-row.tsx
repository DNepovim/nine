import type { ReactNode } from 'react'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { cn } from '@/lib/cn'

// How far apart two rows start. Small — thirteen rows at this spacing have all arrived
// inside a quarter of a second, which is about as long as the card's own entrance. A wider
// step would have the player reading the first figure while the last was still on its way.
const STEP_MS = 18

const FADE_MS = 200

// The line every row of the comparison is drawn on, and the way it arrives.
//
// One height for the whole table, so the career block and the boards block beat at the same
// rate and the two read as one document rather than as two. The rows drop in one after the
// other down the card: a table that assembles tells the reader where to start, where a table
// that is simply there asks them to find the top of it themselves.
export function CompareRow({
  // The row's place in the whole table, counted across both blocks rather than restarting
  // at the boards — the sequence runs down the card, not down each panel.
  index,
  // Set on a row that sums the ones above it, which draws a rule over itself. The same
  // device the winnings card puts over its total, and for the same reason: a figure that
  // is about the rows above it has to be told apart from one that is another of them.
  ruled = false,
  children,
}: {
  index: number
  ruled?: boolean
  children: ReactNode
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * STEP_MS).duration(FADE_MS)}
      className={cn('h-7 flex-row items-center', ruled && 'border-t border-dim/20')}
    >
      {children}
    </Animated.View>
  )
}
