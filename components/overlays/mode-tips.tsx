import { useCallback, useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { TipSizer } from '@/components/overlays/tip-sizer'
import { PageDots } from '@/components/page-dots'
import { SWIPE_THRESHOLD } from '@/constants/game'
import { TIPS } from '@/constants/tips'
import { MODE_GRADIENT } from '@/machines/game'

// Trainee's own colour, worn by the border and the dots alike. This panel shows
// in Trainee and nowhere else, and the mode scale is what says which mode you are
// in.
//
// One hue for both is the trick: the dots hang on the border's centreline, so
// sharing a colour is what makes the row read as the border going dotted rather
// than as a meter parked on top of it.
const TINT = MODE_GRADIENT.trainee[0]

// The line is held right back — a third — so it frames the tip without competing
// with the mode selector above it, while the dots stay solid because they are the
// control and want to be seen.
//
// Alpha on the colour rather than an `opacity` style: opacity applies to the whole
// subtree, so it would take the card and its text down with the border. Tune here
// — 55 is a third, 99 is 60%, CC is 80%.
const BORDER_TINT = `${TINT}55`

const ROTATE_MS = 6000
const FADE_MS = 200

// How far the outgoing tip drifts as it leaves, and the incoming one travels as
// it arrives. Small: this answers the gesture, it does not carry the content.
const SLIDE_PX = 16

// Forward through the list — what a swipe left does, and where the timer goes.
const FORWARD = 1
const BACK = -1

// The what's-new dialog's edge at half weight — thinner and tighter, because this
// is a 256px panel rather than a full-width sheet. A plain border rather than that
// dialog's padded-gradient sandwich: one flat colour needs no gradient, and React
// Native draws borders inside the box, so the line still ends exactly at the card's
// bounds and the dots' offset below is unaffected.
const BORDER = 1
const RADIUS = 20

// Tips vary in length, and this sits directly above PLAY. A box that fitted each tip
// on its own would hop the button every six seconds, so all five share one height —
// the tallest, measured by TipSizer. Sizing to the content rather than to a constant
// is what keeps a newly-written long tip from being cropped.
//
// This is only the floor, holding the box open for the frame before the measurements
// land. Tips shorter than it stay centred in it.
const BODY_MIN_HEIGHT = 96

// A 6px dot inside px-1 py-2 pressables. Hard-coded rather than measured because
// it decides where the row hangs, and onLayout would land a frame late — the
// dots would visibly drop onto the border after the panel appeared.
const DOTS_HEIGHT = 22

// Centre the row on the border's centreline, so half of it sits inside the card
// and half outside and the dots read as the border continuing.
const DOTS_OFFSET = -(DOTS_HEIGHT / 2 - BORDER / 2)

// Fills the slot the leaderboard occupies in Accuracy and Speed. Trainee is where
// a new player starts and had nothing there at all, which made the mode that most
// needs teaching the one that said the least.
export function ModeTips() {
  const [index, setIndex] = useState(0)
  // Grows to the tallest tip and stays there — the box must not resize as the
  // rotation moves through tips shorter than the one that set the height.
  const [bodyHeight, setBodyHeight] = useState(BODY_MIN_HEIGHT)
  const fade = useSharedValue(1)
  const slide = useSharedValue(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Where the running transition is headed. A second swipe part-way through
  // updates this, so whichever fade finishes lands on the tip the player last
  // asked for rather than on one they have already swiped past.
  const targetRef = useRef(0)

  const tip = TIPS[index] ?? TIPS[0]

  const measure = useCallback((height: number) => {
    setBodyHeight((current) => (height > current ? height : current))
  }, [])

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: slide.value }],
  }))

  // Every route to another tip goes through here — the timer, a dot, a swipe —
  // so they all cancel the pending rotation and all animate the same way.
  const goTo = useCallback(
    (next: number, direction: number) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      targetRef.current = next

      // Swap at the trough rather than cross-fading two copies: one Text means the
      // box never has to hold both tips at once.
      const enter = () => {
        setIndex(targetRef.current)
        slide.value = withSequence(
          withTiming(direction * SLIDE_PX, { duration: 0 }),
          withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }),
        )
        fade.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.quad) })
      }

      slide.value = withTiming(-direction * SLIDE_PX, {
        duration: FADE_MS,
        easing: Easing.in(Easing.quad),
      })
      fade.value = withTiming(
        0,
        { duration: FADE_MS, easing: Easing.in(Easing.quad) },
        (finished) => {
          'worklet'
          if (finished) scheduleOnRN(enter)
        },
      )
    },
    [fade, slide],
  )

  const step = useCallback(
    (direction: number) => {
      goTo((index + direction + TIPS.length) % TIPS.length, direction)
    },
    [goTo, index],
  )

  // Re-armed whenever the tip changes, so a swipe or a tapped dot buys a full
  // dwell on the tip it landed on instead of inheriting the remainder.
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      step(FORWARD)
    }, ROTATE_MS)
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [index, step])

  // Left goes forward, right goes back, both wrapping — same as the rotation, so
  // swiping never reaches an end that refuses to move.
  const swipe = Gesture.Pan().onEnd((e) => {
    'worklet'
    if (e.translationX <= -SWIPE_THRESHOLD) scheduleOnRN(step, FORWARD)
    else if (e.translationX >= SWIPE_THRESHOLD) scheduleOnRN(step, BACK)
  })

  return (
    <View className="mb-8 w-full max-w-3xs self-center">
      <GestureDetector gesture={swipe}>
        <View
          className="bg-surface px-4 pb-5 pt-3"
          style={{ borderRadius: RADIUS, borderWidth: BORDER, borderColor: BORDER_TINT }}
        >
          <Text
            selectable={false}
            className="mb-1 text-center font-mono text-[9px] font-bold tracking-[2px] text-dim"
          >
            TIP
          </Text>

          {/* overflow-hidden keeps the departing tip inside the card rather than
              letting it drift out over the border. */}
          <View className="overflow-hidden" style={{ height: bodyHeight }}>
            <Animated.View
              style={[{ height: bodyHeight, justifyContent: 'center' }, bodyStyle]}
            >
              <Text
                selectable={false}
                className="text-center font-mono text-[12px] font-medium leading-[19px] text-primary"
              >
                {tip}
              </Text>
            </Animated.View>
          </View>

          <TipSizer onMeasure={measure} />
        </View>
      </GestureDetector>

      {/* The dots hang off the bottom edge rather than sitting under the card, so
          the border appears to go dotted where they are. The surface-coloured strip
          is what breaks the line: the card's inside and the screen outside are both
          bg-surface, so it is invisible from either direction.

          box-none keeps the full-width row from swallowing presses meant for what
          is below it — only the dots themselves take a touch. */}
      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 items-center"
        style={{ bottom: DOTS_OFFSET }}
      >
        <View className="bg-surface px-1.5">
          <PageDots
            total={TIPS.length}
            current={index}
            color={TINT}
            uniform
            onSelect={(next) => {
              if (next !== index) goTo(next, next > index ? FORWARD : BACK)
            }}
          />
        </View>
      </View>
    </View>
  )
}
