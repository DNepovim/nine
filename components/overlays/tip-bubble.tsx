import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { View, type DimensionValue } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'

// The caret over the bubble, drawn as a rotated square whose upper half sticks out past
// the card's edge. React Native has no border-triangle worth the arithmetic, and a square
// on its corner is the same shape once the card covers the bottom of it.
const CARET = 10

// It closes itself. Nothing in a bubble is acted on, and one left open after the player
// has moved on to something else is just something in the way.
const HOLD_MS = 6000

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

// Which thing is explaining itself, or null — and back to null on its own after
// `HOLD_MS`. A value rather than a boolean, because a row of marks has one question per
// glyph; a caller with only one thing to explain passes `true`.
export function useSelfClosing<T>() {
  const [open, setOpen] = useState<T | null>(null)

  useEffect(() => {
    if (open === null) return
    const id = setTimeout(() => {
      setOpen(null)
    }, HOLD_MS)
    return () => {
      clearTimeout(id)
    }
  }, [open])

  return [open, setOpen] as const
}

// A card hanging under something tapped, with a caret pointing back up at it — the
// marks' explanation over a name, and the exact fortune under its shortened figure.
//
// Absolutely placed, so the caller's box decides where it hangs: that box has to be
// lifted (`z-50`) over whatever is drawn after it, and as wide as the bubble may grow,
// because an absolute child can be no wider than its parent.
export function TipBubble({
  id,
  top,
  width,
  tint,
  caretShift = 0,
  onClose,
  children,
}: {
  // The press that closes it, for analytics.
  id: ButtonId
  // How far below the top of the caller's box the caret's tip sits.
  top: DimensionValue
  // Unset, the bubble is as wide as what is in it.
  width?: number
  // The border, and the caret's two visible edges — the colour of what it is about.
  tint: string
  // How far the caret slides off centre to sit under the thing tapped.
  caretShift?: number
  onClose: () => void
  children: ReactNode
}) {
  const border = `${tint}55`

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(140)}
      className="absolute items-center"
      // Its own width, given up where there is less room than that — a percentage
      // rather than a measurement, read against the caller's box.
      style={{ top, width, maxWidth: '100%' }}
    >
      {/* Any tap closes it. There is nothing in here to act on, so an X to aim at would
          be a control standing between the player and the screen. */}
      <TrackedPressable id={id} onPress={onClose}>
        <View
          className="rounded-2xl bg-card px-3.5 py-2.5"
          style={{ ...shadow, borderWidth: 1, borderColor: border }}
        >
          {children}
        </View>
        {/* Pulled up by half its side so the card's edge cuts it in two, and centred by
            hand rather than by `self-center`: an absolute child is out of the card's
            flow, and alignment has nothing left to act on. The two borders it wears are
            the two the rotation leaves facing what was tapped. */}
        <View
          className="absolute rotate-45 bg-card"
          style={{
            width: CARET,
            height: CARET,
            top: -CARET / 2,
            left: '50%',
            marginLeft: -CARET / 2 + caretShift,
            borderLeftWidth: 1,
            borderTopWidth: 1,
            borderColor: border,
          }}
        />
      </TrackedPressable>
    </Animated.View>
  )
}
