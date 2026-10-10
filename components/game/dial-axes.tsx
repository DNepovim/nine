import { Text, View } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import type { DialMetrics } from '@/lib/dial-metrics'
import { dialFactors, type DialSpec } from '@/modes'

// The room the column labels need above the dial.
//
// Exported because the thing that has to leave it is not this: the labels are drawn
// absolutely, off the dial's own box and into whatever is above it, so the band the
// lesson talks in is what keeps its lower edge clear of them. The dial must not move to
// make room for a label about it, which is what rules out laying these out in the flow.
export const AXIS_STRIP = 20

// How far each label sits from the box, and how much of it there is to place: a line of
// `TYPE.labelSm`, and enough width for two characters of it.
const LABEL_HEIGHT = 12
const LABEL_WIDTH = 18
const LABEL_GAP = 6

// What a column or row multiplier prints. The × is the whole difference between this and
// a number in the game: every other figure on the screen is in the target's units, and
// these two are what those units are made of — the same mark the key's own weight badge
// wears, for the same reason.
const times = (factor: number): string => `${factor}×`

// The dial's two multipliers, printed where they apply: one over each column and one
// beside each row.
//
// A key is worth its row's multiplier times its column's, and nothing on the dial says so
// — the weight badge gives the product, which is the number a player needs and not the
// rule behind it. The lesson explains the rule once and then leaves these up, so the dial
// it was explained on is the dial the player goes on practising with.
//
// Grey and small on purpose: these are labels on the instrument rather than figures in the
// game, and anything louder would be read as another number to add up. Drawn outside the
// keys entirely, so no digit and no badge has to move over.
export function DialAxes({ dial, metrics }: { dial: DialSpec; metrics: DialMetrics }) {
  const { rows, cols } = dialFactors(dial)
  const stride = metrics.button + metrics.gap
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(260).easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {cols.map((factor, col) => (
        <View
          key={`col-${String(col)}`}
          style={{
            position: 'absolute',
            top: -(LABEL_HEIGHT + LABEL_GAP),
            left: col * stride,
            width: metrics.button,
            height: LABEL_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text selectable={false} className={cn(TYPE.labelSm, 'text-dim')}>
            {times(factor)}
          </Text>
        </View>
      ))}
      {rows.map((factor, row) => (
        <View
          key={`row-${String(row)}`}
          style={{
            position: 'absolute',
            left: -(LABEL_WIDTH + LABEL_GAP),
            top: row * stride,
            width: LABEL_WIDTH,
            height: metrics.button,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text selectable={false} className={cn(TYPE.labelSm, 'text-dim')}>
            {times(factor)}
          </Text>
        </View>
      ))}
    </Animated.View>
  )
}
