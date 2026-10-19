import { Trans, useLingui } from '@lingui/react/macro'
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

import { LEGEND_BOX, LegendBox } from '@/components/overlays/legend-box'
import { TipSizer } from '@/components/overlays/tip-sizer'
import { PageDots } from '@/components/page-dots'
import { SWIPE_THRESHOLD } from '@/constants/game'
import { SLOT_CARD } from '@/constants/intro-slot'
import { TIPS } from '@/constants/tips'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { pickTips } from '@/lib/pick-tips'
import { gradientOf } from '@/modes'

// Trainee's own colour, worn by the border and the dots alike. This panel shows
// in Trainee and nowhere else, and the mode scale is what says which mode you are
// in.
//
// One hue for both is the trick: the dots hang on the border's centreline, so
// sharing a colour is what makes the row read as the border going dotted rather
// than as a meter parked on top of it.
const TINT = gradientOf('trainee')[0]

// How many of the tips a visit gets. Not all of them: at ROTATE_MS each, the full list
// is half a minute of reading parked above the PLAY button, and a panel that always
// shows the same tips in the same order stops being read. Three is a set the dots can
// still be counted at a glance, and a fresh three every visit is worth another look.
const TIP_COUNT = 3

const ROTATE_MS = 6000
const FADE_MS = 200

// How far the outgoing tip drifts as it leaves, and the incoming one travels as
// it arrives. Small: this answers the gesture, it does not carry the content.
const SLIDE_PX = 16

// Forward through the list — what a swipe left does, and where the timer goes.
const FORWARD = 1
const BACK = -1

// Half the legend's own height, which is what `LegendBox` hangs above its box and so what
// the card costs the slot over and above its padding.
//
// A constant because the slot's budget below is arithmetic rather than a measurement, and
// this is the one term in it that is a measurement — `TYPE.sectionLabel` is 9px, whose
// line box comes out around 11. Being a point out either way is invisible; the check that
// matters is the one the slot's own note describes, which is watching PLAY GAME while
// pressing through the pills.
const LEGEND_LIFT = 6

// Everything the card carries above and below the tip itself: `pt-4` and `pb-5`, the two
// border lines, and the legend's overhang. Named because it is what turns the one height
// the slot is allowed into the height this box may give a tip.
//
// The TIP label used to be in here too, at 15 — a line of the box spent on saying what the
// box is. It rides the rule now, so what it costs is the overhang alone and the rest went
// back to the tip.
const CARD_CHROME = 16 + 20 + LEGEND_BOX.border * 2 + LEGEND_LIFT

// Tips vary in length, and this sits directly above PLAY. A box that fitted each tip on
// its own would hop the button every six seconds, so all of them share one height — and
// that height is not the tallest tip's but the slot's, so the card comes out exactly as
// tall as the board ACCURACY and SPEED put here and the button stays where it was when the
// player pressed the pill.
//
// Still a floor rather than a cap, and TipSizer still measures: a tip written longer than
// this fits grows the box instead of being cropped. That growth is the signal — a tip that
// moves PLAY GAME is a tip to shorten, not a slot to re-measure.
const BODY_MIN_HEIGHT = SLOT_CARD.height - CARD_CHROME

// A 6px dot inside px-1 py-2 pressables. Hard-coded rather than measured because
// it decides where the row hangs, and onLayout would land a frame late — the
// dots would visibly drop onto the border after the panel appeared.
const DOTS_HEIGHT = 22

// Centre the row on the border's centreline, so half of it sits inside the card
// and half outside and the dots read as the border continuing.
const DOTS_OFFSET = -(DOTS_HEIGHT / 2 - LEGEND_BOX.border / 2)

// Fills the slot the leaderboard occupies in Accuracy and Speed. Trainee is where
// a new player starts and had nothing there at all, which made the mode that most
// needs teaching the one that said the least.
export function ModeTips() {
  const [index, setIndex] = useState(0)
  // Drawn once per mount, so the rotation cannot reshuffle under a tip being read — and
  // so leaving Trainee and coming back deals a new hand.
  const [tips] = useState(() =>
    pickTips(
      TIPS,
      TIP_COUNT,
      Array.from({ length: TIP_COUNT }, () => Math.random()),
    ),
  )
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

  // TIPS is a non-empty tuple and TIP_COUNT is at least one, so the fallback is
  // unreachable — it is here because the index type cannot say so.
  const { t } = useLingui()
  const tip = tips[index] ?? TIPS[0]

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
      goTo((index + direction + tips.length) % tips.length, direction)
    },
    [goTo, index, tips.length],
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
        <LegendBox legend={<Trans>TIP</Trans>} color={TINT} className="px-4 pb-5 pt-4">
          {/* overflow-hidden keeps the departing tip inside the card rather than
              letting it drift out over the border. */}
          <View className="overflow-hidden" style={{ height: bodyHeight }}>
            <Animated.View
              style={[{ height: bodyHeight, justifyContent: 'center' }, bodyStyle]}
            >
              <Text
                selectable={false}
                className={cn(TYPE.prose, 'text-center text-primary')}
              >
                {t(tip)}
              </Text>
            </Animated.View>
          </View>

          <TipSizer tips={tips} onMeasure={measure} />
        </LegendBox>
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
            total={tips.length}
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
