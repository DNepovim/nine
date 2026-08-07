import { Ionicons } from '@expo/vector-icons'
import { ScrollView, Text, View } from 'react-native'

import { GuideBullet } from '@/components/guide/guide-bullet'
import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { STEP_COLORS } from '@/constants/tutorial'
import type { LessonProps } from '@/types/tutorial'

const COLOR = STEP_COLORS[5] ?? '#FF8C00'

export function TipsLesson({ nextButton }: LessonProps) {
  return (
    <View className="flex-1">
      <LessonHeading title="TIPS & TRICKS" color={COLOR}>
        {'Four habits that turn the basics into a decent score.'}
      </LessonHeading>

      <ScrollView
        className="mt-2 flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        <GuideBullet color={COLOR}>
          Coarse first, fine last — the ×9 and ×6 buttons close the distance, the ×1 and
          ×2 land the hit.
        </GuideBullet>
        <GuideBullet color={COLOR}>
          Swipe to 0 or 9 instead of tapping through — one move instead of nine.
        </GuideBullet>
        <GuideBullet color={COLOR}>
          When several targets share the board, go for the one nearest your current total.
        </GuideBullet>
        <GuideBullet color={COLOR}>
          Stuck on the exact number? Two light buttons together can reach what one can’t.
        </GuideBullet>

        <View
          className="mt-6 flex-row items-center gap-3 rounded-2xl px-4 py-4"
          style={{ backgroundColor: `${COLOR}1F` }}
        >
          <Ionicons name="rocket" size={19} color={COLOR} />
          <Text
            selectable={false}
            className="flex-1 font-mono text-[12px] font-bold leading-[18px]"
            style={{ color: COLOR }}
          >
            {
              'That’s everything. Next stop: a Trainee run, where nothing can go wrong — take your time.'
            }
          </Text>
        </View>

        <Text
          selectable={false}
          className="mt-4 font-mono text-[11px] font-medium leading-[17px] text-dim"
        >
          {
            'The full rulebook — scoring, difficulties, streaks — is always in How to Play, along with this tutorial if you want another run through it.'
          }
        </Text>

        {nextButton}
      </ScrollView>
    </View>
  )
}
