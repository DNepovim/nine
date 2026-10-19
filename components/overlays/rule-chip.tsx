import type { ReactNode } from 'react'
import { View } from 'react-native'

import { cn } from '@/lib/cn'

// How far in from a corner a chip may be set, and how much breath it keeps either side.
//
// `CHIP_X` is the corner's own radius, which is the smallest gap that leaves the curve
// whole: a chip set in any closer would cut across the arc, and a corner clipped
// mid-turn reads as a drawing error rather than as an interruption. Handed in rather
// than fixed, because the two boxes that use this do not share a radius.
const CHIP_PAD = 6

// One thing standing in a box's top rule, with the rule broken behind it.
//
// Its ground is two colours and not one, which is the whole of this component. A chip
// centred on the rule has half of itself outside the box and half inside, and those two
// halves stand on different things: whatever the box stands on above, the box's own
// ground below. Painted all one colour it is a tab stuck on the surface; painted in
// halves it is not a tab at all — it is the rule simply stopping, with whatever was
// already on each side of the line carrying on through the gap.
//
// Which means the caller has to say what those two grounds are. They are the same class
// as often as not — a box the colour of the screen it stands on, which is both of this
// component's callers today — and `GradientFrame`'s white inner box is why they are two
// props rather than one.
//
// Lifted by half of its own measured height, which is the only way two chips of
// different heights sit on one line — a constant would centre the word and leave the
// board low, or the other way about. Rounded, so the seam between the two halves lands
// on a whole pixel and does not show as a hairline. Hidden until it has been measured,
// since the frame before that is the one frame it would be in the wrong place.
//
// `pointerEvents` is off: a card that is one big button should not have the things
// standing on its rule taking presses out of it.
export function RuleChip({
  side,
  inset,
  height,
  onHeight,
  above = 'bg-surface',
  below = 'bg-surface',
  children,
}: {
  // Which end of the rule it stands at. `centre` is where a legend goes when the box has
  // only one thing to be called; a box with a badge as well puts the two at the ends.
  side: 'left' | 'right' | 'centre'
  // How far in from the corner, for the sided cases. The box's own radius.
  inset: number
  height: number
  onHeight: (height: number) => void
  // The ground above the rule — what the box stands on — and below it, which is the
  // box's own.
  above?: string
  below?: string
  children: ReactNode
}) {
  const lift = Math.round(height / 2)
  return (
    <View
      pointerEvents="none"
      className="absolute"
      style={{
        top: -lift,
        // Centring is a full-width row with the chip centred in it, rather than an
        // offset: the chip's width is its word's and is not known here.
        ...(side === 'centre'
          ? { left: 0, right: 0, alignItems: 'center' }
          : { [side]: inset }),
        opacity: height === 0 ? 0 : 1,
      }}
      onLayout={(e) => {
        onHeight(e.nativeEvent.layout.height)
      }}
    >
      <View style={{ paddingHorizontal: CHIP_PAD }}>
        <View
          className={cn('absolute left-0 right-0 top-0', above)}
          style={{ height: lift }}
        />
        <View
          className={cn('absolute bottom-0 left-0 right-0', below)}
          style={{ top: lift }}
        />
        {children}
      </View>
    </View>
  )
}
