import { Text, View } from 'react-native'

import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { MiniGrid } from '@/components/overlays/tutorial/mini-grid'
import { TargetBadge } from '@/components/overlays/tutorial/target-badge'
import {
  COARSE_CELL,
  FINE_CELL,
  GOAL_EXAMPLE_COARSE,
  GOAL_EXAMPLE_FINE,
  GOAL_EXAMPLE_TARGET,
  STEP_COLORS,
} from '@/constants/tutorial'
import { emptyCells, setCell } from '@/lib/tutorial-grid'

const COLOR = STEP_COLORS[0] ?? '#4C7EFF'

const EXAMPLE_CELLS = setCell(
  setCell(emptyCells(), FINE_CELL, GOAL_EXAMPLE_FINE),
  COARSE_CELL,
  GOAL_EXAMPLE_COARSE,
)

export function GoalLesson() {
  return (
    <View className="flex-1">
      <LessonHeading title="THE GOAL" color={COLOR}>
        {
          'A number lands on the board. Dial the nine buttons until your total matches it.'
        }
      </LessonHeading>

      <View className="flex-1 items-center justify-center">
        <TargetBadge value={GOAL_EXAMPLE_TARGET} size={72} />

        <View className="mt-6">
          <MiniGrid
            cells={EXAMPLE_CELLS}
            highlight={[FINE_CELL, COARSE_CELL]}
            color={COLOR}
          />
        </View>

        <Text
          selectable={false}
          className="mt-4 font-mono text-[13px] font-black tracking-[1px] text-primary"
        >
          {`${GOAL_EXAMPLE_FINE} × 1  +  ${GOAL_EXAMPLE_COARSE} × 9  =  ${GOAL_EXAMPLE_TARGET}`}
        </Text>
        <Text
          selectable={false}
          className="mt-2 text-center font-mono text-[11px] font-medium leading-[17px] text-dim"
        >
          {'Every button is worth more or less depending on where it sits.'}
        </Text>
      </View>
    </View>
  )
}
