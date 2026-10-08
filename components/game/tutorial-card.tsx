import { useState } from 'react'
import {
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, { Easing, FadeInDown, FadeOut } from 'react-native-reanimated'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { gradientOf } from '@/modes'

// The tutorial's colour, worn by its card the way the tips panel and the route hint wear
// it — a line the lesson is saying, not a line the game is reporting.
const TINT = gradientOf('trainee')[0]

// Lifted off the board, in the same dress the step-up toast wears: this floats over the
// playfield rather than sitting in it, and the shadow is what says so before the words are
// read. On the bordered card itself, not on the animated wrapper — a shadow needs an opaque
// shape to be cast from, and the wrapper has none.
const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

// How it arrives and how it goes. Down and fading up on the way in, straight out on the way
// out, on the app's own easings: out for anything entering, in for anything leaving.
//
// Shorter leaving than arriving. A card is dismissed by a tap here, so its exit is playing
// over a player who has already finished with it and is reaching for the dial.
const ENTER = FadeInDown.duration(220).easing(Easing.out(Easing.cubic))
const LEAVE = FadeOut.duration(160).easing(Easing.in(Easing.cubic))

// Where the beak points, or that there is nothing to point at.
export type CardBeak = 'up' | 'down' | 'none'

// The beak: a square turned on its corner, sitting a little outside the card so its two
// outward edges carry on the card's own outline. Drawn as a child of the card, which is
// what puts its fill over the border segment it crosses and leaves no seam.
const BEAK = 10
const BEAK_OUT = 5

// How far from either end the beak may come. The card's corner radius plus a little, so a
// beak aimed at something out near the edge rests beside the curve rather than crossing it
// — where it would read as a chip out of the card instead of as a point.
const BEAK_INSET = 20

// One line of the tutorial, in the one card it says everything in.
//
// The beak is the whole difference between a tooltip and a banner here, and that is
// deliberate: a lesson that pointed with one shape and talked with another would read as
// two voices. It points when there is something on screen the words are about — the target,
// the sum — and drops the beak when the words are about what the player should do next.
//
// Capped and centred in whatever band it is put in, and it measures itself so the beak can
// be aimed: where the card's left edge ends up depends on how wide that band turned out to
// be, which is not something the caller can work out for it.
export function TutorialCard({
  text,
  beak,
  anchorX,
  style,
}: {
  text: string
  beak: CardBeak
  // What the beak points at, as an x measured in the same space the card is placed in.
  // Undefined centres the beak, which is what a centred anchor and a beak of `none` both
  // want.
  anchorX?: number
  // Where the card goes. On the animated wrapper, because that is the view the lesson
  // mounts and unmounts and so the one whose exit has to be able to play from where the
  // card stood. A style rather than a class because the geometry is runtime: a card
  // pointing at a target is placed from that target's own position.
  style?: StyleProp<ViewStyle>
}) {
  // The card's own box within the wrapper, which is what the beak is placed against.
  //
  // Measured rather than worked out, because the card is centred and capped: how far in its
  // left edge sits depends on how wide the band it was put in turned out to be. Null until
  // the first layout, which is one frame with the beak in the middle — and the card is
  // fading in over that frame anyway.
  const [box, setBox] = useState<{ x: number; width: number } | null>(null)
  const measure = (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout
    setBox((current) =>
      current?.x === x && current.width === width ? current : { x, width },
    )
  }

  // Where the point lands along the card. Centred when there is nothing to aim at or
  // nothing measured yet, and otherwise held inside the card's straight edge.
  const aim =
    anchorX === undefined || box === null
      ? null
      : Math.min(
          Math.max(anchorX - box.x - BEAK / 2, BEAK_INSET),
          Math.max(BEAK_INSET, box.width - BEAK_INSET - BEAK),
        )

  return (
    <Animated.View pointerEvents="none" entering={ENTER} exiting={LEAVE} style={style}>
      <View
        onLayout={measure}
        // Capped and centred rather than spanning whatever it is put in: a line this short
        // stretched across the whole board reads as a bar the game has grown, where a card
        // the width of its own sentence reads as something said over it. The same cap the
        // step-up toast uses, so the two things that float over a run are the same size.
        className="w-full max-w-3xs self-center rounded-2xl border bg-card px-4 py-2.5"
        style={{ borderColor: TINT, ...shadow }}
      >
        <Text
          selectable={false}
          className={cn(TYPE.buttonSm, 'text-center text-primary')}
        >
          {text}
        </Text>
        {beak !== 'none' && (
          <View
            className="absolute rotate-45 bg-card"
            style={{
              width: BEAK,
              height: BEAK,
              ...(aim === null ? { left: '50%', marginLeft: -BEAK / 2 } : { left: aim }),
              // The two edges that meet at the pointing corner, and only those: a square
              // with all four would draw a diamond floating beside the card.
              ...(beak === 'down'
                ? {
                    bottom: -BEAK_OUT,
                    borderRightWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: TINT,
                  }
                : {
                    top: -BEAK_OUT,
                    borderLeftWidth: 1,
                    borderTopWidth: 1,
                    borderColor: TINT,
                  }),
            }}
          />
        )}
      </View>
    </Animated.View>
  )
}
