import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { LiveDialGrid } from '@/components/overlays/tutorial/live-dial-grid'
import { SubStepDots } from '@/components/overlays/tutorial/sub-step-dots'
import { SumReadout } from '@/components/overlays/tutorial/sum-readout'
import { TaskPrompt } from '@/components/overlays/tutorial/task-prompt'
import {
  COARSE_CELL,
  FINE_CELL,
  STEP_COLORS,
  WEIGHTS_COARSE_SUM,
  WEIGHTS_FINE_SUM,
} from '@/constants/tutorial'
import { dialCell, emptyCells, setCell, sumCells } from '@/lib/tutorial-grid'
import type { LessonProps } from '@/types/tutorial'

const COLOR = STEP_COLORS[2] ?? '#c36282'

// Two swipes, side by side: the weakest button maxed out, then the strongest.
const WEIGHT_TASKS = [
  {
    cell: FINE_CELL,
    prompt: 'Swipe the ×1 button — top-left — to the right.',
    reveal: `Maxed out, that whole button is worth ${WEIGHTS_FINE_SUM}.`,
  },
  {
    cell: COARSE_CELL,
    prompt: 'Now swipe the ×9 button — bottom-right — to the right.',
    reveal: `Same digit, nine times the punch: the total jumps to ${WEIGHTS_COARSE_SUM}.`,
  },
] as const

export function WeightsLesson({ isDark, onComplete }: LessonProps) {
  const [cells, setCells] = useState<readonly number[]>(emptyCells)
  const [taskIndex, setTaskIndex] = useState(0)
  const task = WEIGHT_TASKS[taskIndex]
  const previous = WEIGHT_TASKS[taskIndex - 1]

  useEffect(() => {
    if (task === undefined) onComplete()
  }, [task, onComplete])

  // The gate is "this button reads 9", however the player got it there. Watching
  // the resulting value rather than the swipe itself keeps the step from
  // dead-ending when the button already sits on 9 (DialButton then has no change
  // to report), and a nine-tap route is just as instructive.
  useEffect(() => {
    if (task !== undefined && cells[task.cell] === 9) {
      setTaskIndex((step) => step + 1)
    }
  }, [task, cells])

  return (
    <View className="flex-1">
      <LessonHeading title="POSITION IS POWER" color={COLOR}>
        {'A button’s weight is its row × its column — the small print above each digit.'}
      </LessonHeading>

      <TaskPrompt
        text={task?.prompt ?? 'That’s the trick — now put it to work.'}
        done={task === undefined}
        color={COLOR}
      />
      <SubStepDots total={WEIGHT_TASKS.length} current={taskIndex} color={COLOR} />

      <View className="mt-3 items-center">
        <SumReadout sum={sumCells(cells)} isDark={isDark} />
        <Text
          selectable={false}
          className="mt-1 min-h-[30px] px-6 text-center font-mono text-[11px] font-bold leading-[15px] tracking-[0.5px] text-dim"
        >
          {previous?.reveal ?? 'BOARD TOTAL'}
        </Text>
      </View>

      <LiveDialGrid
        cells={cells}
        isDark={isDark}
        showWeights
        hintCell={task?.cell ?? null}
        hintGesture="right"
        hintColor={COLOR}
        onDelta={(index, delta) => {
          setCells((current) => dialCell(current, index, delta))
        }}
        onSet={(index, value) => {
          setCells((current) => setCell(current, index, value))
        }}
      />
    </View>
  )
}
