import { useEffect, useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { ModeCard } from '@/components/guide/mode-card'
import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { STEP_COLORS } from '@/constants/tutorial'
import { useViewport } from '@/hooks/use-viewport'
import { cn } from '@/lib/cn'
import { MODE_ORDER, MODES, type Mode } from '@/machines/game'

const COLOR = STEP_COLORS[5] ?? '#FF8C00'

const GAP = 12
// How much of a neighbouring card shows past the current one's edge on either
// side — enough to read as "there's more here", not so much it looks cropped.
const PEEK = 32
// Caps the card on wide screens (tablets, web) — past this it reads as a banner
// rather than a card, and the neighbours' peek would all but disappear.
const MAX_CARD_WIDTH = 340
// The overlay's own px-4, cancelled below so the peeking neighbours can reach the
// true screen edge. Set as a style rather than the `-mx-4` class: this number has
// to match what the centring math below assumes width means, and a literal here
// keeps that assumption visible in one place instead of split across a class name
// and a constant.
const SCREEN_EDGE = 16

// How long the scroll position has to sit still before it counts as settled and
// gets pulled to the nearest card. `snapToInterval` is a no-op on the web build —
// react-native-web never turns it into CSS scroll-snap — so nothing actually
// anchored the carousel there, and `onMomentumScrollEnd` alongside it is unreliable
// on the same platform. A quiet-period timer works identically everywhere instead:
// no platform has to be asked whether it snapped on its own.
const SETTLE_MS = 120

// Lives and streaks belong to the mode that owns them, so each card carries its
// own — no separate hearts section to cross-reference.
const MODE_FACTS = {
  trainee: [
    'No lives, no score, a relaxed clock — practice.',
    'Buttons show their weight, like the last two screens.',
    'Each target wears a grey badge: the fewest moves needed to hit it from here.',
  ],
  accuracy: [
    'Solve each target in the fewest possible moves.',
    'Three hearts. A badly wasteful hit costs one, and so does letting a ring empty.',
    'Hit every target in its optimal move count to build a ×2 → ×4 → ×8 streak.',
  ],
  speed: [
    'Short clock — the sooner you hit, the more it scores.',
    'Three hearts. Let a target’s ring empty and you lose one; lose all three and the run ends.',
    'Clear the whole board to fire the same ×2 → ×4 → ×8 streak.',
  ],
} as const satisfies Record<Mode, readonly string[]>

// A classic peeking carousel: the current mode sits centred, with a slice of its
// neighbour showing on either side rather than the row starting flush with one
// card in full view. That slice is the "swipe for more" cue — no arrows needed.
export function ModesLesson() {
  const { width } = useViewport()
  const [index, setIndex] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  // Whether a finger (or pointer) is currently down on the carousel. The settle
  // timer only ever runs while this is false — otherwise a slow drag that pauses
  // mid-gesture would get yanked to the nearest card out from under the player's
  // finger before they had let go.
  const draggingRef = useRef(false)
  const lastXRef = useRef(0)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Solving `sidePadding = (width - cardWidth) / 2` for a target PEEK: the card
  // sits sidePadding from the screen edge, and the neighbour's edge is a further
  // GAP beyond that — so the visible sliver of it is sidePadding - GAP, which is
  // PEEK exactly when cardWidth is built this way. Capped at MAX_CARD_WIDTH on
  // wide screens; sidePadding is solved from whichever width actually won, so the
  // card stays centred either way — it just picks up a wider peek past the cap
  // instead of growing past it.
  const cardWidth = Math.min(MAX_CARD_WIDTH, width - 2 * (PEEK + GAP))
  const step = cardWidth + GAP
  const sidePadding = (width - cardWidth) / 2

  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), MODE_ORDER.length - 1)
    setIndex(clamped)
    scrollRef.current?.scrollTo({ x: clamped * step, animated: true })
  }

  const clearSettleTimer = () => {
    if (settleTimerRef.current === null) return
    clearTimeout(settleTimerRef.current)
    settleTimerRef.current = null
  }

  // Pulls the carousel to whichever card is nearest wherever it currently sits,
  // and moves the dots to match — the one place both the scroll position and the
  // index it implies are decided together, so they can never name two different
  // cards.
  const settle = () => {
    goTo(Math.round(lastXRef.current / step))
  }

  // Restarts the quiet-period timer on every scroll event during the momentum
  // phase; a drag still in progress skips it entirely. `settle` firing is what
  // "the scroll position stopped changing" looks like without a platform telling
  // us so directly.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    lastXRef.current = e.nativeEvent.contentOffset.x
    if (draggingRef.current) return
    clearSettleTimer()
    settleTimerRef.current = setTimeout(settle, SETTLE_MS)
  }

  const onScrollBeginDrag = () => {
    draggingRef.current = true
    clearSettleTimer()
  }

  // Covers the release itself: a slow drag let go with no momentum behind it
  // produces no further onScroll events, so nothing would otherwise start the
  // clock that snaps it home.
  const onScrollEndDrag = () => {
    draggingRef.current = false
    clearSettleTimer()
    settleTimerRef.current = setTimeout(settle, SETTLE_MS)
  }

  useEffect(() => clearSettleTimer, [])

  return (
    <View className="flex-1">
      <LessonHeading title="MODES" color={COLOR}>
        {'Same grid, different pressure. Swipe through the three.'}
      </LessonHeading>

      {/* Not inside a flex-1 parent: a horizontal ScrollView would stretch to fill
          it and strand the cards at the top.

          Full-bleed: a negative margin cancels the overlay's own px-4 so the
          peeking neighbours run all the way to the screen edge instead of
          stopping short of it — set inline rather than as a `-mx-4` class, since
          the width the centring math above assumes has to match this exactly.
          The padding that centres the first and last card lives inside the
          scroll content instead. */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        scrollEventThrottle={16}
        style={{ marginHorizontal: -SCREEN_EDGE }}
        contentContainerStyle={{ gap: GAP, paddingHorizontal: sidePadding }}
      >
        {MODE_ORDER.map((mode, i) => (
          <Animated.View
            key={mode}
            entering={FadeInDown.delay(120 + i * 90).duration(400)}
            style={{ width: cardWidth }}
          >
            {/* A tap anywhere on a peeking neighbour jumps straight to it — the
                same destination a swipe reaches, just without the swipe. Tapping
                the card already showing is a same-index no-op. */}
            <Pressable
              onPress={() => {
                goTo(i)
              }}
            >
              <ModeCard mode={mode} facts={[...MODE_FACTS[mode]]} />
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Mode names rather than dots: three peer destinations, not an abstract
          position in a sequence, so the stepper can just say what they are. Right
          under the carousel it labels, not the dots' usual gap below. */}
      <View className="mt-2 flex-row items-center justify-center gap-6">
        {MODE_ORDER.map((mode, i) => (
          <Pressable
            key={mode}
            hitSlop={8}
            onPress={() => {
              goTo(i)
            }}
          >
            <Text
              selectable={false}
              className={cn(
                'font-mono text-[11px] font-black tracking-[1.5px]',
                i !== index && 'text-dim',
              )}
              style={i === index ? { color: COLOR } : undefined}
            >
              {MODES[mode].label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
