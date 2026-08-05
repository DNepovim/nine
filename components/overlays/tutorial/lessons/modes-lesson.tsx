import { AntDesign } from '@expo/vector-icons'
import { ScrollView, Text, View } from 'react-native'

import { GuideBullet } from '@/components/guide/guide-bullet'
import { GuideCard } from '@/components/guide/guide-card'
import { ModeCard } from '@/components/guide/mode-card'
import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { STEP_COLORS } from '@/constants/tutorial'

const COLOR = STEP_COLORS[4] ?? '#E5534B'

export function ModesLesson() {
  return (
    <View className="flex-1">
      <LessonHeading title="MODES & LIVES" color={COLOR}>
        {
          'Same grid, different pressure. Difficulty — Easy, Hard, Extreme — tightens the clock and puts more targets on the board at once.'
        }
      </LessonHeading>

      <ScrollView
        className="mt-1 flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        <ModeCard
          mode="trainee"
          facts={[
            'No lives, no score, a relaxed clock — practice.',
            'Buttons show their weight and max, like the last two screens.',
            'Each target wears a grey badge — the fewest moves needed to hit it from where the board is now. It updates as you dial.',
          ]}
        />
        <ModeCard
          mode="accuracy"
          facts={[
            'Solve each target in the fewest possible moves.',
            'Every wasted move costs you points; a really wasteful hit costs a heart.',
          ]}
        />
        <ModeCard
          mode="speed"
          facts={[
            'Short clock — the sooner you hit, the more it scores.',
            'Clear the whole board to fire your combo streak.',
          ]}
        />

        <GuideCard>
          <View className="flex-row items-center gap-2">
            {[0, 1, 2].map((i) => (
              <AntDesign key={i} name="heart" size={14} color="#E5534B" />
            ))}
            <Text
              selectable={false}
              className="font-mono text-[11px] font-black tracking-[1.5px] text-primary"
            >
              THREE HEARTS
            </Text>
          </View>
          <GuideBullet color="#E5534B">
            Let a target’s ring empty and you lose one. Lose all three and the run ends.
          </GuideBullet>
          <GuideBullet color="#FF8C00">
            Perfect plays back to back build a streak that multiplies points ×2 → ×4 → ×8.
          </GuideBullet>
        </GuideCard>
      </ScrollView>
    </View>
  )
}
