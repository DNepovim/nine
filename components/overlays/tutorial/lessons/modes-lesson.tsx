import { ScrollView, useWindowDimensions, View } from 'react-native'

import { ModeCard } from '@/components/guide/mode-card'
import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { STEP_COLORS } from '@/constants/tutorial'
import { MODE_ORDER, type Mode } from '@/machines/game'
import type { LessonProps } from '@/types/tutorial'

const COLOR = STEP_COLORS[4] ?? '#E5534B'

const GAP = 12
// Leaves the next card peeking, so the row reads as swipeable.
const PEEK = 44

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

export function ModesLesson({ nextButton }: LessonProps) {
  const { width } = useWindowDimensions()
  const cardWidth = width - 32 - PEEK

  return (
    <View className="flex-1">
      <LessonHeading title="MODES & LIVES" color={COLOR}>
        {'Same grid, different pressure. Swipe through the three.'}
      </LessonHeading>

      {/* Not inside a flex-1 parent: a horizontal ScrollView would stretch to fill
          it and strand the cards at the top. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + GAP}
        decelerationRate="fast"
        contentContainerStyle={{ gap: GAP, paddingRight: PEEK }}
      >
        {MODE_ORDER.map((mode) => (
          <View key={mode} style={{ width: cardWidth }}>
            <ModeCard mode={mode} facts={[...MODE_FACTS[mode]]} />
          </View>
        ))}
      </ScrollView>

      <View className="flex-1" />
      {nextButton}
    </View>
  )
}
