import type { ReactNode } from 'react'
import Animated, { FadeInDown } from 'react-native-reanimated'

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
  children,
}: {
  index: number
  children: ReactNode
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * STEP_MS).duration(FADE_MS)}
      className="h-7 flex-row items-center"
    >
      {children}
    </Animated.View>
  )
}
