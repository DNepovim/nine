import { useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

import { RuleChip } from './rule-chip'

// The box's own edge. A hairline rather than a rule: what is framed here is a paragraph,
// and anything heavier reads as a box drawn around a box — the same judgement
// `GradientFrame` makes about the row it frames, one weight down because this one is not
// also carrying a gradient.
export const LEGEND_BOX = { radius: 20, border: 1 } as const

// How far back the edge is held from the colour it is drawn in: a third, as hex alpha.
//
// Alpha on the colour rather than an `opacity` style, which would take the box's contents
// down with its border. Tune here — 55 is a third, 99 is 60%, CC is 80%.
const EDGE_ALPHA = '55'

// A bordered box with its name set into the top rule.
//
// Two cards in the app are this shape and say the same kind of thing: TIP on the intro,
// which is what Trainee puts where a scored mode puts its board, and STRIKE in the
// challenge dialog, which is how the multiplier is built in a mode the player has never
// met. Both are one short paragraph that has to be read as an aside rather than as the
// screen's own voice, and a named box is what says that before a word of it is read.
//
// The name rides the rule rather than standing inside the box — the arrangement the
// challenge banner wears CHALLENGE in, and the reason the two are one component now. It
// costs the content nothing, which is the point: a label inside the box spends a line of
// the box on saying what the box is.
//
// Centred rather than set at the left end, which is where `GradientFrame` puts its
// legend. That box has a badge at the other end and a row of its own inside; these two
// are centred cards with one thing to be called, and a legend hanging off the left corner
// of a centred paragraph reads as having come loose from it.
export function LegendBox({
  legend,
  color,
  className,
  children,
}: {
  // What the box is, said on the box. The caller's node, because it is a translated
  // string.
  legend: ReactNode
  // The hue the edge is drawn in, held back to a third. Whatever the card is about: the
  // mode's own stop on the intro, the challenge's own ink in the dialog.
  color: string
  // Classes for the box — the padding, and anything else about the ground the content
  // stands on. Never the shape: the radius and the border are this component's.
  className?: string
  children: ReactNode
}) {
  const [legendHeight, setLegendHeight] = useState(0)

  return (
    // Pushed down by half the chip that hangs above it, so the box gives up the room
    // rather than relying on whatever it stands in not to clip — see the same margin on
    // `GradientFrame`, which is there because the intro's paging panels do clip.
    <View style={{ marginTop: Math.round(legendHeight / 2) }}>
      <View
        className={cn('bg-surface', className)}
        style={{
          borderRadius: LEGEND_BOX.radius,
          borderWidth: LEGEND_BOX.border,
          borderColor: `${color}${EDGE_ALPHA}`,
        }}
      >
        {children}
      </View>

      {/* Last, so it is over the edge rather than under it: what breaks the rule is the
        chip's own ground, and a ground can only do that from on top. Both halves are the
        app's surface, which is what this box and everything that has held one so far
        both stand on. */}
      <RuleChip
        side="centre"
        inset={LEGEND_BOX.radius}
        height={legendHeight}
        onHeight={setLegendHeight}
      >
        <Text selectable={false} className={cn(TYPE.sectionLabel, 'text-dim')}>
          {legend}
        </Text>
      </RuleChip>
    </View>
  )
}
