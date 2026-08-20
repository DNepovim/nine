import { ScrollView, useWindowDimensions, View } from 'react-native'

import { ModeCard } from '@/components/guide/mode-card'
import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { STEP_COLORS } from '@/constants/tutorial'
import { MODE_ORDER, type Mode } from '@/machines/game'

const COLOR = STEP_COLORS[4] ?? '#E5534B'

const GAP = 12
// Leaves the next card peeking, so the row reads as swipeable.
const PEEK = 44
// The overlay's own px-4, re-applied inside the scroll content — see the note below.
const EDGE = 16

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

export function ModesLesson() {
  const { width } = useWindowDimensions()
  // A card starts EDGE from the left, so leaving PEEK of the next one showing at the
  // right screen edge costs it the gap as well. Now that the track is full-bleed, PEEK
  // is exactly how much of the next card the player sees.
  const cardWidth = width - EDGE - GAP - PEEK

  return (
    <View className="flex-1">
      <LessonHeading title="MODES & LIVES" color={COLOR}>
        {'Same grid, different pressure. Swipe through the three.'}
      </LessonHeading>

      {/* Not inside a flex-1 parent: a horizontal ScrollView would stretch to fill
          it and strand the cards at the top.

          Full-bleed: -mx-4 cancels the overlay's px-4 so the track runs to the screen
          edges and the peeking card is cut off by the screen rather than stopping short
          of it. The padding moves inside the content instead, which keeps the first
          card's left edge lined up with the heading above and still lets the last one
          scroll clear. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + GAP}
        decelerationRate="fast"
        className="-mx-4"
        contentContainerStyle={{ gap: GAP, paddingHorizontal: EDGE }}
      >
        {MODE_ORDER.map((mode) => (
          <View key={mode} style={{ width: cardWidth }}>
            <ModeCard mode={mode} facts={[...MODE_FACTS[mode]]} />
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
