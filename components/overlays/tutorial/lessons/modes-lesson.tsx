import { useRef, useState } from 'react'
import {
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { ModeCard } from '@/components/guide/mode-card'
import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { PageDots } from '@/components/page-dots'
import { STEP_COLORS } from '@/constants/tutorial'
import { MODE_ORDER, type Mode } from '@/machines/game'

const COLOR = STEP_COLORS[5] ?? '#FF8C00'

const GAP = 12
// How much of a neighbouring card shows past the current one's edge on either
// side — enough to read as "there's more here", not so much it looks cropped.
const PEEK = 32

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
  const { width } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  // Solving `sidePadding = (width - cardWidth) / 2` for a target PEEK: the card
  // sits sidePadding from the screen edge, and the neighbour's edge is a further
  // GAP beyond that — so the visible sliver of it is sidePadding - GAP, which is
  // PEEK exactly when cardWidth is built this way.
  const cardWidth = width - 2 * (PEEK + GAP)
  const step = cardWidth + GAP
  const sidePadding = (width - cardWidth) / 2

  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), MODE_ORDER.length - 1)
    setIndex(clamped)
    scrollRef.current?.scrollTo({ x: clamped * step, animated: true })
  }

  // Fires once the snap settles, so the dots follow where the carousel actually
  // stopped rather than wherever a drag let go mid-flight.
  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / step)
    setIndex(Math.min(Math.max(next, 0), MODE_ORDER.length - 1))
  }

  return (
    <View className="flex-1">
      <LessonHeading title="MODES" color={COLOR}>
        {'Same grid, different pressure. Swipe through the three.'}
      </LessonHeading>

      {/* Not inside a flex-1 parent: a horizontal ScrollView would stretch to fill
          it and strand the cards at the top.

          Full-bleed: -mx-4 cancels the overlay's px-4 so the peeking neighbours run
          all the way to the screen edge instead of stopping short of it. The
          padding that centres the first and last card lives inside the scroll
          content instead. */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumScrollEnd}
        className="-mx-4"
        contentContainerStyle={{ gap: GAP, paddingHorizontal: sidePadding }}
      >
        {MODE_ORDER.map((mode, i) => (
          <Animated.View
            key={mode}
            entering={FadeInDown.delay(120 + i * 90).duration(400)}
            style={{ width: cardWidth }}
          >
            <ModeCard mode={mode} facts={[...MODE_FACTS[mode]]} />
          </Animated.View>
        ))}
      </ScrollView>

      {/* The same stepper Trainee's tip panel uses — uniform dots, since browsing
          three peer modes isn't progress toward anything, just a position to jump to. */}
      <View className="mt-4 items-center">
        <PageDots
          total={MODE_ORDER.length}
          current={index}
          color={COLOR}
          uniform
          onSelect={goTo}
        />
      </View>
    </View>
  )
}
